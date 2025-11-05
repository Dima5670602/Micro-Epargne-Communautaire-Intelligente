const pool = require("../config/database");

async function sendMessage(req, res) {
  try {
    const { receiver_id, tontine_id, corridor_id, content, message } = req.body;
    const sender_id = req.user.id;

    console.log(`Envoi message de ${sender_id} vers ${receiver_id}`);

    // Utiliser 'content' ou 'message' selon ce qui est envoyé
    const messageContent = content || message;
    
    if (!receiver_id || !messageContent) {
      return res.status(400).json({
        success: false,
        message: "Destinataire et contenu du message sont requis"
      });
    }

    // Vérifier si le destinataire existe
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [receiver_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Destinataire non trouvé"
      });
    }

    // Créer le message dans la base de données - utiliser la colonne 'message'
    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, tontine_id, corridor_id, message) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [sender_id, receiver_id, tontine_id || null, corridor_id || null, messageContent]
    );

    const newMessage = result.rows[0];

    console.log(`Message envoyé avec ID: ${newMessage.id}`);

    res.status(201).json({
      success: true,
      message: "Message envoyé avec succès",
      data: newMessage
    });

  } catch (err) {
    console.error('Erreur sendMessage:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'envoi du message',
      error: err.message
    });
  }
}

async function getConversation(req, res) {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    const { tontineId, corridorId } = req.query;

    console.log(`Récupération conversation entre ${currentUserId} et ${userId}`);

    let query = `
      SELECT m.*, 
             u1.prenom as sender_prenom, u1.nom as sender_nom,
             u2.prenom as receiver_prenom, u2.nom as receiver_nom
      FROM messages m
      INNER JOIN users u1 ON m.sender_id = u1.id
      INNER JOIN users u2 ON m.receiver_id = u2.id
      WHERE ((m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1))
    `;
    
    const params = [currentUserId, userId];
    let paramCount = 2;

    if (tontineId) {
      paramCount++;
      query += ` AND m.tontine_id = $${paramCount}`;
      params.push(tontineId);
    }

    if (corridorId) {
      paramCount++;
      query += ` AND m.corridor_id = $${paramCount}`;
      params.push(corridorId);
    }

    query += ` ORDER BY m.created_at ASC`;

    const result = await pool.query(query, params);

    console.log(`${result.rows.length} message(s) récupéré(s)`);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur getConversation:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération de la conversation',
      error: err.message
    });
  }
}

// Récupère toutes les conversations d'un utilisateur
async function getUserConversations(req, res) {
  try {
    const userId = req.user.id;
    console.log(`Récupération des conversations pour l'utilisateur ${userId}`);

    // REQUÊTE CORRIGÉE - sans commentaires SQL
    const result = await pool.query(
      `SELECT 
        DISTINCT ON (
          CASE 
            WHEN m.sender_id = $1 THEN m.receiver_id 
            ELSE m.sender_id 
          END
        )
        m.id,
        m.sender_id,
        m.receiver_id,
        m.message,
        m.tontine_id,
        m.corridor_id,
        m.is_read,
        m.created_at,
        CASE 
          WHEN m.sender_id = $1 THEN m.receiver_id 
          ELSE m.sender_id 
        END as other_user_id,
        u.prenom, 
        u.nom, 
        u.email,
        t.name as tontine_name,
        c.name as corridor_name,
        (SELECT COUNT(*) FROM messages 
         WHERE ((sender_id = $1 AND receiver_id = u.id) 
                OR (sender_id = u.id AND receiver_id = $1))
         AND is_read = false AND receiver_id = $1) as unread_count
      FROM messages m
      INNER JOIN users u ON (
        CASE 
          WHEN m.sender_id = $1 THEN m.receiver_id 
          ELSE m.sender_id 
        END = u.id
      )
      LEFT JOIN tontines t ON m.tontine_id = t.id
      LEFT JOIN corridors c ON m.corridor_id = c.id
      WHERE m.sender_id = $1 OR m.receiver_id = $1
      ORDER BY 
        CASE 
          WHEN m.sender_id = $1 THEN m.receiver_id 
          ELSE m.sender_id 
        END,
        m.created_at DESC`,
      [userId]
    );

    console.log(`${result.rows.length} conversation(s) récupérée(s)`);

    // Formater les données pour le frontend
    const formattedConversations = result.rows.map(conv => ({
      ...conv,
      last_message: conv.message,
      last_message_date: conv.created_at,
      content: conv.message
    }));

    res.json({
      success: true,
      data: formattedConversations
    });

  } catch (err) {
    console.error('Erreur détaillée getUserConversations:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des conversations',
      error: err.message
    });
  }
}

/**
 * Marque les messages comme lus
 */
async function markAsRead(req, res) {
  try {
    const { messageIds, senderId } = req.body;
    const userId = req.user.id;

    console.log(`Marquage messages comme lus pour l'utilisateur ${userId}`);

    let result;
    
    if (messageIds && messageIds.length > 0) {
      result = await pool.query(
        `UPDATE messages 
         SET is_read = true, read_at = CURRENT_TIMESTAMP
         WHERE id = ANY($1) AND receiver_id = $2 AND is_read = false
         RETURNING id`,
        [messageIds, userId]
      );
    } else if (senderId) {
      result = await pool.query(
        `UPDATE messages 
         SET is_read = true, read_at = CURRENT_TIMESTAMP
         WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false
         RETURNING id`,
        [senderId, userId]
      );
    } else {
      return res.status(400).json({
        success: false,
        message: "IDs des messages ou ID de l'expéditeur requis"
      });
    }

    console.log(`${result.rows.length} message(s) marqué(s) comme lu`);

    res.json({
      success: true,
      message: `${result.rows.length} message(s) marqué(s) comme lu`,
      markedCount: result.rows.length
    });

  } catch (err) {
    console.error('Erreur markAsRead:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du marquage des messages comme lus',
      error: err.message
    });
  }
}

//Récupère les messages non lus
async function getUnreadMessages(req, res) {
  try {
    const userId = req.user.id;

    console.log(`Récupération messages non lus pour l'utilisateur ${userId}`);

    const result = await pool.query(
      `SELECT m.*, u.prenom as sender_prenom, u.nom as sender_nom
       FROM messages m
       INNER JOIN users u ON m.sender_id = u.id
       WHERE m.receiver_id = $1 AND m.is_read = false
       ORDER BY m.created_at DESC`,
      [userId]
    );

    console.log(`${result.rows.length} message(s) non lu(s) trouvé(s)`);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error('Erreur getUnreadMessages:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des messages non lus',
      error: err.message
    });
  }
}

async function deleteMessage(req, res) {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    console.log(`Suppression du message ${messageId} par l'utilisateur ${userId}`);

    // Vérifier que l'ID est un nombre valide
    if (!messageId || isNaN(parseInt(messageId))) {
      return res.status(400).json({
        success: false,
        message: "ID de message invalide"
      });
    }

    const messageIdInt = parseInt(messageId);

    const message = await pool.query(
      'SELECT * FROM messages WHERE id = $1',
      [messageIdInt]
    );

    if (message.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Message non trouvé"
      });
    }

    const messageData = message.rows[0];

    if (messageData.sender_id !== userId && messageData.receiver_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Non autorisé à supprimer ce message"
      });
    }

    await pool.query(
      'DELETE FROM messages WHERE id = $1',
      [messageIdInt]
    );

    console.log(`Message ${messageId} supprimé avec succès`);

    res.json({
      success: true,
      message: "Message supprimé avec succès"
    });

  } catch (err) {
    console.error('Erreur deleteMessage:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression du message',
      error: err.message
    });
  }
}

async function deleteConversation(req, res) {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    const { tontineId, corridorId } = req.query;

    console.log(`Suppression conversation entre ${currentUserId} et ${userId}`);

    let query = `
      DELETE FROM messages 
      WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
    `;
    
    const params = [currentUserId, userId];
    let paramCount = 2;

    if (tontineId) {
      paramCount++;
      query += ` AND tontine_id = $${paramCount}`;
      params.push(tontineId);
    }

    if (corridorId) {
      paramCount++;
      query += ` AND corridor_id = $${paramCount}`;
      params.push(corridorId);
    }

    const result = await pool.query(query, params);

    console.log(`${result.rowCount} message(s) supprimé(s) de la conversation`);

    res.json({
      success: true,
      message: `Conversation supprimée avec succès (${result.rowCount} messages supprimés)`,
      deletedCount: result.rowCount
    });

  } catch (err) {
    console.error('Erreur deleteConversation:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression de la conversation',
      error: err.message
    });
  }
}

async function clearAllMessages(req, res) {
  try {
    const userId = req.user.id;

    console.log(`Suppression de tous les messages pour l'utilisateur ${userId}`);

    const result = await pool.query(
      `DELETE FROM messages 
       WHERE sender_id = $1 OR receiver_id = $1`,
      [userId]
    );

    console.log(`${result.rowCount} message(s) supprimé(s) au total`);

    res.json({
      success: true,
      message: `Tous les messages ont été supprimés (${result.rowCount} messages supprimés)`,
      deletedCount: result.rowCount
    });

  } catch (err) {
    console.error('Erreur clearAllMessages:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression des messages',
      error: err.message
    });
  }
}

// Exporter toutes les fonctions
module.exports = {
  sendMessage,
  getConversation,
  getUserConversations,
  markAsRead,
  getUnreadMessages,
  deleteMessage,
  deleteConversation,
  clearAllMessages
};