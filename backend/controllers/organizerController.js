const pool = require('../config/database');
const { createNotification } = require('./notificationController');

async function createTontine(req, res) {
  try {
    const { nom, montant_par_participant, duree_jours, bareme } = req.body;
    const organisateur_id = req.user.id;

    if (!nom || !montant_par_participant || !duree_jours) {
      return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' });
    }

    const query = `
      INSERT INTO tontines (nom, montant_par_participant, duree_jours, bareme, organisateur_id, token_unique)
      VALUES ($1,$2,$3,$4,$5,gen_random_uuid())
      RETURNING *;
    `;
    const values = [nom, montant_par_participant, duree_jours, bareme || null, organisateur_id];
    const result = await pool.query(query, values);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur createTontine:', err);
    res.status(500).json({ message: 'Erreur serveur création tontine' });
  }
}

async function createCorridor(req, res) {
  try {
    const { nom_corridor, bareme } = req.body;
    const organisateur_id = req.user.id;

    if (!nom_corridor) return res.status(400).json({ message: 'Nom du corridor requis' });

    const query = `
      INSERT INTO corridors (nom_corridor, bareme, organisateur_id, token_unique)
      VALUES ($1,$2,$3,gen_random_uuid())
      RETURNING *;
    `;
    const values = [nom_corridor, bareme || null, organisateur_id];
    const result = await pool.query(query, values);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur createCorridor:', err);
    res.status(500).json({ message: 'Erreur serveur création corridor' });
  }
}

async function updateTontine(req, res) {
  try {
    const { id } = req.params;
    const { nom, montant_par_participant, duree_jours, bareme, description } = req.body;
    const organisateur_id = req.user.id;

    const ownershipCheck = await pool.query(
      'SELECT id FROM tontines WHERE id = $1 AND owner_id = $2',
      [id, organisateur_id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const query = `
      UPDATE tontines 
      SET nom = $1, montant_par_participant = $2, duree_jours = $3, bareme = $4, description = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *;
    `;
    const values = [nom, montant_par_participant, duree_jours, bareme, description, id];
    const result = await pool.query(query, values);

    res.json({ success: true, data: result.rows[0], message: 'Tontine mise à jour avec succès' });
  } catch (err) {
    console.error('Erreur updateTontine:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

async function updateCorridor(req, res) {
  try {
    const { id } = req.params;
    const { nom_corridor, bareme, commission } = req.body;
    const organisateur_id = req.user.id;

    const ownershipCheck = await pool.query(
      'SELECT id FROM corridors WHERE id = $1 AND owner_id = $2',
      [id, organisateur_id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const query = `
      UPDATE corridors 
      SET nom_corridor = $1, bareme = $2, commission = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *;
    `;
    const values = [nom_corridor, bareme, commission, id];
    const result = await pool.query(query, values);

    res.json({ success: true, data: result.rows[0], message: 'Corridor mis à jour avec succès' });
  } catch (err) {
    console.error('Erreur updateCorridor:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

async function replaceParticipant(req, res) {
  try {
    const { tontineId, oldUserId, newUserEmail } = req.body;
    const organisateur_id = req.user.id;

    const ownershipCheck = await pool.query(
      'SELECT id FROM tontines WHERE id = $1 AND owner_id = $2',
      [tontineId, organisateur_id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const newUserResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [newUserEmail]
    );

    if (newUserResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Nouvel utilisateur non trouvé' });
    }

    const newUserId = newUserResult.rows[0].id;

    await pool.query(
      'DELETE FROM tontine_participants WHERE tontine_id = $1 AND user_id = $2',
      [tontineId, oldUserId]
    );

    await pool.query(
      'INSERT INTO tontine_participants (tontine_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [tontineId, newUserId]
    );

    await createNotification(
      oldUserId,
      'Remplacement dans la tontine',
      'Vous avez été remplacé dans une tontine',
      { tontineId, type: 'replacement' }
    );

    await createNotification(
      newUserId,
      'Ajout à une tontine',
      'Vous avez été ajouté à une tontine en remplacement',
      { tontineId, type: 'replacement' }
    );

    res.json({ success: true, message: 'Participant remplacé avec succès' });
  } catch (err) {
    console.error('Erreur replaceParticipant:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

async function getActiveTontines(req, res) {
  try {
    const organisateur_id = req.user.id;

    const query = `
      SELECT 
        t.*,
        COUNT(tp.user_id) as participants_count,
        COUNT(CASE WHEN tp.payment_status = 'completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN tp.payment_status = 'pending' THEN 1 END) as pending_payments,
        COALESCE((
          SELECT SUM(amount) FROM payment_history ph 
          WHERE ph.tontine_id = t.id AND status = 'completed'
        ), 0) as total_collected,
        COALESCE((
          SELECT SUM(amount) FROM fund_distributions fd 
          WHERE fd.tontine_id = t.id
        ), 0) as total_distributed
      FROM tontines t
      LEFT JOIN tontine_participants tp ON t.id = tp.tontine_id
      WHERE t.owner_id = $1 AND t.status = 'active'
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `;

    const result = await pool.query(query, [organisateur_id]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur getActiveTontines:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

async function getAllParticipants(req, res) {
  try {
    const organisateur_id = req.user.id;

    const query = `
      SELECT 
        u.id,
        u.prenom,
        u.nom,
        u.email,
        u.telephone,
        t.name as tontine_name,
        tp.payment_status,
        tp.joined_at,
        tp.payment_date,
        COUNT(DISTINCT tp.tontine_id) as total_tontines
      FROM tontine_participants tp
      INNER JOIN tontines t ON tp.tontine_id = t.id
      INNER JOIN users u ON tp.user_id = u.id
      WHERE t.owner_id = $1
      GROUP BY u.id, u.prenom, u.nom, u.email, u.telephone, t.name, tp.payment_status, tp.joined_at, tp.payment_date
      ORDER BY tp.joined_at DESC
    `;

    const result = await pool.query(query, [organisateur_id]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur getAllParticipants:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

async function getActiveCorridors(req, res) {
  try {
    const organisateur_id = req.user.id;

    const query = `
      SELECT 
        c.*,
        COUNT(cp.user_id) as participants_count,
        COUNT(CASE WHEN cp.status = 'active' THEN 1 END) as active_participants,
        COALESCE((
          SELECT SUM(amount) FROM payment_history ph 
          WHERE ph.corridor_id = c.id AND status = 'completed'
        ), 0) as total_collected
      FROM corridors c
      LEFT JOIN corridor_participants cp ON c.id = cp.corridor_id
      WHERE c.owner_id = $1 AND c.status = 'active'
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;

    const result = await pool.query(query, [organisateur_id]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur getActiveCorridors:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

async function managePaymentRound(req, res) {
  try {
    const { tontineId, participantId, amount } = req.body;
    const organisateur_id = req.user.id;

    // Vérifier la propriété
    const ownershipCheck = await pool.query(
      'SELECT id FROM tontines WHERE id = $1 AND owner_id = $2',
      [tontineId, organisateur_id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    // Vérifier si tous les participants ont payé
    const paymentCheck = await pool.query(
      `SELECT COUNT(*) as total, 
              COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as completed
       FROM tontine_participants 
       WHERE tontine_id = $1`,
      [tontineId]
    );

    const { total, completed } = paymentCheck.rows[0];

    if (parseInt(completed) !== parseInt(total)) {
      return res.status(400).json({ 
        success: false, 
        message: `Tous les participants n'ont pas encore payé. ${completed}/${total} paiements effectués.` 
      });
    }

    // Vérifier le solde disponible
    const balance = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_collected,
        COALESCE((SELECT SUM(amount) FROM fund_distributions WHERE tontine_id = $1), 0) as total_distributed
      FROM payment_history 
      WHERE tontine_id = $1 AND status = 'completed'
    `, [tontineId]);

    const availableBalance = parseFloat(balance.rows[0].total_collected) - parseFloat(balance.rows[0].total_distributed);

    if (availableBalance < amount) {
      return res.status(400).json({ 
        success: false, 
        message: `Solde insuffisant. Solde disponible: ${availableBalance} XOF` 
      });
    }

    // Distribuer les fonds
    await pool.query(
      `INSERT INTO fund_distributions (tontine_id, user_id, amount, distributed_by, distribution_date) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [tontineId, participantId, amount, organisateur_id]
    );

    // Marquer le participant comme ayant reçu les fonds
    await pool.query(
      `UPDATE tontine_participants 
       SET funds_received = true, fund_receipt_date = CURRENT_TIMESTAMP 
       WHERE tontine_id = $1 AND user_id = $2`,
      [tontineId, participantId]
    );

    // Notifier le participant
    await createNotification(
      participantId,
      'Tour de table - Fonds distribués 💰',
      `Vous avez reçu ${amount} XOF de la tontine. C'est votre tour de table!`,
      { tontineId, amount, type: 'payment_round' }
    );

    res.json({ 
      success: true, 
      message: `Tour de table effectué avec succès. ${amount} XOF distribués au participant.` 
    });

  } catch (err) {
    console.error('Erreur managePaymentRound:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

async function getProfile(req, res) {
  try {
    const organisateur_id = req.user.id;

    const query = 'SELECT id, nom, prenom, email, role FROM users WHERE id=$1';
    const result = await pool.query(query, [organisateur_id]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur getProfile:', err);
    res.status(500).json({ message: 'Erreur serveur profil' });
  }
}

async function getNotifications(req, res) {
  try {
    const organisateur_id = req.user.id;

    const query = `
      SELECT * FROM notifications 
      WHERE destinataire_id=$1 
      ORDER BY date_creation DESC
      LIMIT 20
    `;
    const result = await pool.query(query, [organisateur_id]);

    res.json(result.rows);
  } catch (err) {
    console.error('Erreur getNotifications:', err);
    res.status(500).json({ message: 'Erreur serveur notifications' });
  }
}

async function handleParticipationRequest(req, res) {
  try {
    const { requestId, action } = req.body;
    const organisateur_id = req.user.id;

    const requestQuery = `
      SELECT pr.*, t.owner_id as tontine_owner, c.owner_id as corridor_owner 
      FROM participation_requests pr
      LEFT JOIN tontines t ON pr.tontine_id = t.id
      LEFT JOIN corridors c ON pr.corridor_id = c.id
      WHERE pr.id = $1 AND (t.owner_id = $2 OR c.owner_id = $2)
    `;
    
    const requestResult = await pool.query(requestQuery, [requestId, organisateur_id]);
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Demande non trouvée' });
    }

    const request = requestResult.rows[0];

    await pool.query(
      'UPDATE participation_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [action === 'accept' ? 'accepted' : 'rejected', requestId]
    );

    if (action === 'accept' && request.tontine_id) {
      await pool.query(
        'INSERT INTO tontine_participants (tontine_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [request.tontine_id, request.user_id]
      );
    }

    if (action === 'accept' && request.corridor_id) {
      await pool.query(
        'INSERT INTO corridor_participants (corridor_id, user_id, status) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [request.corridor_id, request.user_id, 'active']
      );
    }

    const notificationTitle = action === 'accept' ? 'Demande acceptée' : 'Demande refusée';
    const notificationBody = action === 'accept' 
      ? 'Votre demande de participation a été acceptée'
      : 'Votre demande de participation a été refusée';

    await createNotification(
      request.user_id,
      notificationTitle,
      notificationBody,
      { requestId, action, tontine_id: request.tontine_id, corridor_id: request.corridor_id }
    );

    res.json({ 
      success: true, 
      message: `Demande ${action === 'accept' ? 'acceptée' : 'refusée'} avec succès` 
    });

  } catch (err) {
    console.error('Erreur handleParticipationRequest:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

async function getPendingRequests(req, res) {
  try {
    const organisateur_id = req.user.id;

    const query = `
      SELECT 
        pr.id,
        pr.user_id,
        pr.tontine_id,
        pr.corridor_id,
        pr.created_at,
        u.nom,
        u.prenom,
        u.email,
        u.telephone,
        t.name as tontine_nom,
        c.name as corridor_nom,
        t.owner_id as tontine_owner,
        c.owner_id as corridor_owner
      FROM participation_requests pr
      INNER JOIN users u ON pr.user_id = u.id
      LEFT JOIN tontines t ON pr.tontine_id = t.id
      LEFT JOIN corridors c ON pr.corridor_id = c.id
      WHERE pr.status = 'pending' 
        AND (t.owner_id = $1 OR c.owner_id = $1)
      ORDER BY pr.created_at DESC
    `;

    const result = await pool.query(query, [organisateur_id]);
    res.json({ success: true, data: result.rows });

  } catch (err) {
    console.error('Erreur getPendingRequests:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du chargement des demandes'
    });
  }
}

async function getTontineParticipants(req, res) {
  try {
    const { tontineId } = req.params;
    const organisateur_id = req.user.id;

    const ownershipCheck = await pool.query(
      'SELECT id FROM tontines WHERE id = $1 AND owner_id = $2',
      [tontineId, organisateur_id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const query = `
      SELECT 
        u.id,
        u.nom,
        u.prenom,
        u.email,
        u.telephone,
        tp.joined_at,
        tp.payment_status,
        tp.payment_date,
        tp.funds_received,
        tp.fund_receipt_date
      FROM tontine_participants tp
      INNER JOIN users u ON tp.user_id = u.id
      WHERE tp.tontine_id = $1
      ORDER BY tp.joined_at DESC
    `;

    const result = await pool.query(query, [tontineId]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur getTontineParticipants:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

async function addParticipantManually(req, res) {
  try {
    const { tontineId, email } = req.body;
    const organisateur_id = req.user.id;

    const ownershipCheck = await pool.query(
      'SELECT id FROM tontines WHERE id = $1 AND owner_id = $2',
      [tontineId, organisateur_id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    const userId = userResult.rows[0].id;

    await pool.query(
      'INSERT INTO tontine_participants (tontine_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [tontineId, userId]
    );

    await createNotification(
      userId,
      'Ajout à une tontine',
      'Vous avez été ajouté à une tontine par un organisateur',
      { tontineId }
    );

    res.json({ success: true, message: 'Participant ajouté avec succès' });
  } catch (err) {
    console.error('Erreur addParticipantManually:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

async function removeParticipant(req, res) {
  try {
    const { tontineId, userId } = req.body;
    const organisateur_id = req.user.id;

    const ownershipCheck = await pool.query(
      'SELECT id FROM tontines WHERE id = $1 AND owner_id = $2',
      [tontineId, organisateur_id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    await pool.query(
      'DELETE FROM tontine_participants WHERE tontine_id = $1 AND user_id = $2',
      [tontineId, userId]
    );

    res.json({ success: true, message: 'Participant supprimé avec succès' });
  } catch (err) {
    console.error('Erreur removeParticipant:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

async function sendMessageToParticipants(req, res) {
  try {
    const { tontineId, message } = req.body;
    const organisateur_id = req.user.id;

    const ownershipCheck = await pool.query(
      'SELECT id FROM tontines WHERE id = $1 AND owner_id = $2',
      [tontineId, organisateur_id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const participantsResult = await pool.query(
      'SELECT user_id FROM tontine_participants WHERE tontine_id = $1',
      [tontineId]
    );

    for (const participant of participantsResult.rows) {
      await createNotification(
        participant.user_id,
        'Message de l\'organisateur',
        message,
        { tontineId, type: 'organizer_message' }
      );
    }

    res.json({ success: true, message: 'Message envoyé à tous les participants' });
  } catch (err) {
    console.error('Erreur sendMessageToParticipants:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

module.exports = {
  createTontine,
  createCorridor,
  updateTontine,
  updateCorridor,
  replaceParticipant,
  getProfile,
  getNotifications,
  handleParticipationRequest,
  getPendingRequests,
  getTontineParticipants,
  addParticipantManually,
  removeParticipant,
  sendMessageToParticipants,
  getActiveTontines,
  getAllParticipants,
  getActiveCorridors,
  managePaymentRound
};