// models/messageModel.js
const pool = require("../config/database");

/**
 * Crée un nouveau message
 */
async function createMessage(messageData) {
  try {
    const { sender_id, receiver_id, tontine_id, corridor_id, content } = messageData;
    
    const { rows } = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, tontine_id, corridor_id, content) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [sender_id, receiver_id, tontine_id, corridor_id, content]
    );
    
    return rows[0];
  } catch (err) {
    console.error('Erreur createMessage:', err);
    throw err;
  }
}

/**
 * Récupère les messages non lus d'un utilisateur
 */
async function getUnreadMessages(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT 
        m.*,
        u.prenom as sender_prenom,
        u.nom as sender_nom
       FROM messages m
       INNER JOIN users u ON m.sender_id = u.id
       WHERE m.receiver_id = $1 AND m.is_read = false
       ORDER BY m.created_at DESC`,
      [userId]
    );
    
    return rows;
  } catch (err) {
    console.error('Erreur getUnreadMessages:', err);
    throw err;
  }
}

/**
 * Récupère le dernier message de chaque conversation
 */
async function getLastMessages(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (
          CASE 
            WHEN m.sender_id = $1 THEN m.receiver_id 
            ELSE m.sender_id 
          END
        ) 
        m.*,
        CASE 
          WHEN m.sender_id = $1 THEN m.receiver_id
          ELSE m.sender_id
        END as other_user_id,
        u.prenom,
        u.nom,
        u.email
       FROM messages m
       INNER JOIN users u ON (
         CASE 
           WHEN m.sender_id = $1 THEN m.receiver_id
           ELSE m.sender_id
         END = u.id
       )
       WHERE m.sender_id = $1 OR m.receiver_id = $1
       ORDER BY 
         CASE 
           WHEN m.sender_id = $1 THEN m.receiver_id 
           ELSE m.sender_id 
         END,
         m.created_at DESC`,
      [userId]
    );
    
    return rows;
  } catch (err) {
    console.error('Erreur getLastMessages:', err);
    throw err;
  }
}

/**
 * Récupère les conversations d'un utilisateur
 */
async function getUserConversations(userId) {
  try {
    const { rows } = await pool.query(
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
        m.content,
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
    
    return rows;
  } catch (err) {
    console.error('Erreur getUserConversations:', err);
    throw err;
  }
}

/**
 * Marque les messages comme lus
 */
async function markMessagesAsRead(messageIds, userId) {
  try {
    const { rows } = await pool.query(
      `UPDATE messages 
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1) AND receiver_id = $2 AND is_read = false
       RETURNING id`,
      [messageIds, userId]
    );
    
    return rows;
  } catch (err) {
    console.error('Erreur markMessagesAsRead:', err);
    throw err;
  }
}

module.exports = {
  createMessage,
  getUnreadMessages,
  getLastMessages,
  getUserConversations,
  markMessagesAsRead
};