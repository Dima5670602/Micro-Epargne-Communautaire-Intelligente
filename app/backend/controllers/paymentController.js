const pool = require("../config/database");
const { createNotification } = require("./notificationController");

async function updatePaymentStatus(req, res) {
  try {
    const { tontineId, userId, status, amount } = req.body;
    const organisateur_id = req.user.id;

    // Vérifier que l'organisateur possède cette tontine
    const ownershipCheck = await pool.query(
      'SELECT id, name FROM tontines WHERE id = $1 AND owner_id = $2',
      [tontineId, organisateur_id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: "Accès refusé - Vous ne possédez pas cette tontine" 
      });
    }

    // Mettre à jour le statut de paiement
    await pool.query(
      `UPDATE tontine_participants 
       SET payment_status = $1, payment_date = CURRENT_TIMESTAMP 
       WHERE tontine_id = $2 AND user_id = $3`,
      [status, tontineId, userId]
    );

    // Enregistrer dans l'historique des paiements si le paiement est complété
    if (status === 'completed' && amount) {
      await pool.query(
        `INSERT INTO payment_history (tontine_id, user_id, amount, status, paid_to, payment_method, transaction_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tontineId, userId, amount, 'completed', organisateur_id, 'manual', `manual_${Date.now()}`]
      );

      // Créditer le montant à l’organisateur
      await pool.query(
        `UPDATE users SET balance = balance + $1 WHERE id = $2`,
        [amount, organisateur_id]
      );
    }

    // Envoyer une notification au participant
    const notificationTitle = status === 'completed' 
      ? 'Paiement confirmé' 
      : 'Statut de paiement mis à jour';
    
    const notificationBody = status === 'completed'
      ? `Votre paiement de ${amount || ''} XOF a été confirmé pour la tontine "${ownershipCheck.rows[0].name}"`
      : `Votre statut de paiement a été modifié pour la tontine "${ownershipCheck.rows[0].name}"`;

    await createNotification(
      userId,
      notificationTitle,
      notificationBody,
      { tontineId, status, amount }
    );

    res.json({ 
      success: true, 
      message: `Statut de paiement ${status === 'completed' ? 'terminé' : 'mis à jour'}` 
    });

  } catch (err) {
    console.error('Erreur updatePaymentStatus:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la mise à jour du paiement' 
    });
  }
}

async function simulatePayment(req, res) {
  try {
    const { tontineId, amount } = req.body;
    const userId = req.user.id;

    // Vérifier que l'utilisateur est bien participant de cette tontine
    const membershipCheck = await pool.query(
      `SELECT tp.*, t.name as tontine_name, t.owner_id 
       FROM tontine_participants tp
       INNER JOIN tontines t ON tp.tontine_id = t.id
       WHERE tp.tontine_id = $1 AND tp.user_id = $2`,
      [tontineId, userId]
    );

    if (membershipCheck.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: "Vous n'êtes pas participant de cette tontine" 
      });
    }

    const tontine = membershipCheck.rows[0];

    // Vérifier si le participant a déjà payé
    if (tontine.payment_status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: "Vous avez déjà payé votre cotisation pour cette tontine" 
      });
    }

    // Enregistrer le paiement simulé
    await pool.query(
      `INSERT INTO payment_history (tontine_id, user_id, amount, status, payment_method, transaction_id) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tontineId, userId, amount, 'completed', 'simulation', `sim_${Date.now()}_${userId}`]
    );

    // Créditer le montant à l’organisateur
    await pool.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2`,
      [amount, tontine.owner_id]
    );

    // Mettre à jour le statut de paiement du participant
    await pool.query(
      `UPDATE tontine_participants 
       SET payment_status = 'completed', payment_date = CURRENT_TIMESTAMP 
       WHERE tontine_id = $1 AND user_id = $2`,
      [tontineId, userId]
    );

    // Notifier l'organisateur
    await createNotification(
      tontine.owner_id,
      'Paiement reçu',
      `Le participant a payé sa cotisation de ${amount} XOF pour la tontine "${tontine.tontine_name}"`,
      { tontineId, userId, amount, type: 'payment_received' }
    );

    res.json({ 
      success: true, 
      message: `Paiement de ${amount} XOF simulé avec succès` 
    });

  } catch (err) {
    console.error('Erreur simulatePayment:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du traitement du paiement' 
    });
  }
}

/**
 * Distribue les fonds à un participant (Organisateur)
 */
async function distributeFunds(req, res) {
  try {
    const { tontineId, userId, amount } = req.body;
    const organisateur_id = req.user.id;

    // Vérifier que l'organisateur possède cette tontine
    const ownershipCheck = await pool.query(
      'SELECT id, name FROM tontines WHERE id = $1 AND owner_id = $2',
      [tontineId, organisateur_id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: "Accès refusé - Vous ne possédez pas cette tontine" 
      });
    }

    // Vérifier que le participant appartient à la tontine
    const participantCheck = await pool.query(
      'SELECT prenom, nom FROM users WHERE id = $1',
      [userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Participant non trouvé" 
      });
    }

    // Vérifier le solde disponible
    const balance = await getTontineBalanceInternal(tontineId);
    if (balance.current_balance < amount) {
      return res.status(400).json({ 
        success: false, 
        message: `Solde insuffisant. Solde disponible: ${balance.current_balance} XOF` 
      });
    }

    // Enregistrer la distribution
    await pool.query(
      `INSERT INTO fund_distributions (tontine_id, user_id, amount, distributed_by, distribution_date) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [tontineId, userId, amount, organisateur_id]
    );

    // Marquer le participant comme ayant reçu les fonds
    await pool.query(
      `UPDATE tontine_participants 
       SET funds_received = true, fund_receipt_date = CURRENT_TIMESTAMP 
       WHERE tontine_id = $1 AND user_id = $2`,
      [tontineId, userId]
    );

    // Notifier le participant
    await createNotification(
      userId,
      'Fonds distribués',
      `Vous avez reçu ${amount} XOF de la tontine "${ownershipCheck.rows[0].name}"`,
      { tontineId, amount, type: 'funds_distributed' }
    );

    res.json({ 
      success: true, 
      message: `Distribution de ${amount} XOF effectuée avec succès à ${participantCheck.rows[0].prenom} ${participantCheck.rows[0].nom}` 
    });

  } catch (err) {
    console.error('Erreur distributeFunds:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la distribution des fonds' 
    });
  }
}

async function getTontineBalance(req, res) {
  try {
    const { tontineId } = req.params;
    const organisateur_id = req.user.id;

    // Vérifier la propriété
    const ownershipCheck = await pool.query(
      'SELECT id, name FROM tontines WHERE id = $1 AND owner_id = $2',
      [tontineId, organisateur_id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: "Accès refusé" 
      });
    }

    const balance = await getTontineBalanceInternal(tontineId);

    res.json({
      success: true,
      data: {
        tontine: ownershipCheck.rows[0],
        balance: balance
      }
    });

  } catch (err) {
    console.error('Erreur getTontineBalance:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
}

async function getTontineBalanceInternal(tontineId) {
  const balanceQuery = `
    SELECT 
      COALESCE((      ), 0) as total_collected,
      COALESCE((
        SELECT SUM(amount) 
        FROM fund_distributions 
        WHERE tontine_id = $1
      ), 0) as total_distributed,
      COALESCE((
        SELECT SUM(amount) 
        FROM payment_history 
        WHERE tontine_id = $1 AND status = 'completed'
      ), 0) - COALESCE((
        SELECT SUM(amount) 
        FROM fund_distributions 
        WHERE tontine_id = $1
      ), 0) as current_balance
  `;

  const balanceResult = await pool.query(balanceQuery, [tontineId]);
  return balanceResult.rows[0];
}

async function getUserPaymentHistory(req, res) {
  try {
    const userId = req.user.id;

    const paymentHistory = await pool.query(
      `SELECT 
        ph.*,
        t.name as tontine_name,
        u.prenom as organizer_prenom,
        u.nom as organizer_nom
       FROM payment_history ph
       INNER JOIN tontines t ON ph.tontine_id = t.id
       INNER JOIN users u ON t.owner_id = u.id
       WHERE ph.user_id = $1
       ORDER BY ph.payment_date DESC`,
      [userId]
    );

    const fundDistributions = await pool.query(
      `SELECT 
        fd.*,
        t.name as tontine_name,
        u.prenom as distributor_prenom,
        u.nom as distributor_nom
       FROM fund_distributions fd
       INNER JOIN tontines t ON fd.tontine_id = t.id
       INNER JOIN users u ON fd.distributed_by = u.id
       WHERE fd.user_id = $1
       ORDER BY fd.distribution_date DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        payments: paymentHistory.rows,
        distributions: fundDistributions.rows
      }
    });

  } catch (err) {
    console.error('Erreur getUserPaymentHistory:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
}

async function getPaymentOverview(req, res) {
  try {
    const { tontineId } = req.params;
    const organisateur_id = req.user.id;

    // Vérifier la propriété
    const ownershipCheck = await pool.query(
      'SELECT id, name FROM tontines WHERE id = $1 AND owner_id = $2',
      [tontineId, organisateur_id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: "Accès refusé" 
      });
    }

    // Récupérer les statistiques de paiement
    const statsQuery = `
      SELECT 
        COUNT(*) as total_participants,
        COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN funds_received = true THEN 1 END) as funds_distributed,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN amount END), 0) as total_collected
      FROM tontine_participants tp
      LEFT JOIN payment_history ph ON tp.tontine_id = ph.tontine_id AND tp.user_id = ph.user_id
      WHERE tp.tontine_id = $1
    `;

    const statsResult = await pool.query(statsQuery, [tontineId]);
    
    // Récupérer les détails des participants avec statut de paiement
    const participantsQuery = `
      SELECT 
        u.id,
        u.prenom,
        u.nom,
        u.email,
        u.telephone,
        tp.payment_status,
        tp.joined_at,
        tp.payment_date,
        tp.funds_received,
        tp.fund_receipt_date,
        ph.amount,
        (SELECT SUM(amount) FROM fund_distributions fd WHERE fd.tontine_id = tp.tontine_id AND fd.user_id = u.id) as total_received
      FROM tontine_participants tp
      INNER JOIN users u ON tp.user_id = u.id
      LEFT JOIN payment_history ph ON tp.tontine_id = ph.tontine_id AND tp.user_id = ph.user_id
      WHERE tp.tontine_id = $1
      ORDER BY tp.joined_at DESC
    `;

    const participantsResult = await pool.query(participantsQuery, [tontineId]);

    // Récupérer le solde
    const balance = await getTontineBalanceInternal(tontineId);

    res.json({
      success: true,
      data: {
        tontine: ownershipCheck.rows[0],
        stats: { ...statsResult.rows[0], ...balance },
        participants: participantsResult.rows
      }
    });

  } catch (err) {
    console.error('Erreur getPaymentOverview:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
}

async function sendPaymentReminder(req, res) {
  try {
    const { tontineId, message } = req.body;
    const organisateur_id = req.user.id;

    // Vérifier la propriété
    const ownershipCheck = await pool.query(
      'SELECT id, name FROM tontines WHERE id = $1 AND owner_id = $2',
      [tontineId, organisateur_id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: "Accès refusé" 
      });
    }

    const tontine = ownershipCheck.rows[0];

    // Récupérer les participants avec paiement en attente
    const pendingParticipants = await pool.query(
      `SELECT DISTINCT u.id, u.prenom, u.nom, u.email
       FROM tontine_participants tp
       INNER JOIN users u ON tp.user_id = u.id
       WHERE tp.tontine_id = $1 AND tp.payment_status = 'pending'`,
      [tontineId]
    );

    // Envoyer une notification à chaque participant
    const defaultMessage = `Rappel: Veuillez effectuer votre paiement pour la tontine "${tontine.name}"`;
    
    for (const participant of pendingParticipants.rows) {
      await createNotification(
        participant.id,
        'Rappel de paiement',
        message || defaultMessage,
        { tontineId, type: 'payment_reminder' }
      );
    }

    res.json({
      success: true,
      message: `Rappel envoyé à ${pendingParticipants.rows.length} participant(s)`
    });

  } catch (err) {
    console.error('Erreur sendPaymentReminder:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
}

async function getOrganizerBalance(req, res) {
  try {
    const organizerId = req.user.id;

    console.log(`💰 Récupération du solde pour l'organisateur ${organizerId}`);

    // Solde des tontines
    const tontinesBalance = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_balance
       FROM payment_history 
       WHERE tontine_id IN (
         SELECT id FROM tontines WHERE owner_id = $1
       ) AND status = 'completed'`,
      [organizerId]
    );

    // Solde des corridors
    const corridorsBalance = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_balance
       FROM corridor_payments 
       WHERE corridor_id IN (
         SELECT id FROM corridors WHERE owner_id = $1
       ) AND status = 'completed'`,
      [organizerId]
    );

    const totalBalance = 
      parseFloat(tontinesBalance.rows[0].total_balance) + 
      parseFloat(corridorsBalance.rows[0].total_balance);

    console.log(`Solde total récupéré: ${totalBalance} XOF`);

    res.json({
      success: true,
      data: {
        total_balance: totalBalance,
        tontines_balance: parseFloat(tontinesBalance.rows[0].total_balance),
        corridors_balance: parseFloat(corridorsBalance.rows[0].total_balance)
      }
    });

  } catch (err) {
    console.error('Erreur getOrganizerBalance:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération du solde',
      error: err.message
    });
  }
}

async function getOrganizerStats(req, res) {
  try {
    const organizerId = req.user.id;

    console.log(`📊 Récupération des stats pour l'organisateur ${organizerId}`);

    // Nombre de tontines actives
    const tontinesCount = await pool.query(
      'SELECT COUNT(*) as count FROM tontines WHERE owner_id = $1',
      [organizerId]
    );

    // Nombre de corridors actifs
    const corridorsCount = await pool.query(
      'SELECT COUNT(*) as count FROM corridors WHERE owner_id = $1',
      [organizerId]
    );

    // Nombre total de participants dans les tontines
    const tontineParticipants = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as count 
       FROM tontine_participants 
       WHERE tontine_id IN (SELECT id FROM tontines WHERE owner_id = $1)`,
      [organizerId]
    );

    // Nombre total de participants dans les corridors
    const corridorParticipants = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as count 
       FROM corridor_participants 
       WHERE corridor_id IN (SELECT id FROM corridors WHERE owner_id = $1)`,
      [organizerId]
    );

    // Demandes en attente
    const pendingRequests = await pool.query(
      `SELECT COUNT(*) as count FROM participation_requests 
       WHERE tontine_id IN (SELECT id FROM tontines WHERE owner_id = $1)
       AND status = 'pending'`,
      [organizerId]
    );

    // Récupérer aussi le solde
    const balanceResult = await pool.query(
      `SELECT 
        (SELECT COALESCE(SUM(amount), 0) FROM payment_history 
         WHERE tontine_id IN (SELECT id FROM tontines WHERE owner_id = $1) 
         AND status = 'completed') as tontines_balance,
        (SELECT COALESCE(SUM(amount), 0) FROM corridor_payments 
         WHERE corridor_id IN (SELECT id FROM corridors WHERE owner_id = $1) 
         AND status = 'completed') as corridors_balance`,
      [organizerId]
    );

    const totalBalance = 
      parseFloat(balanceResult.rows[0].tontines_balance) + 
      parseFloat(balanceResult.rows[0].corridors_balance);

    const stats = {
      total_tontines: parseInt(tontinesCount.rows[0].count),
      total_corridors: parseInt(corridorsCount.rows[0].count),
      total_participants: parseInt(tontineParticipants.rows[0].count) + parseInt(corridorParticipants.rows[0].count),
      pending_requests: parseInt(pendingRequests.rows[0].count),
      total_balance: totalBalance,
      tontines_balance: parseFloat(balanceResult.rows[0].tontines_balance),
      corridors_balance: parseFloat(balanceResult.rows[0].corridors_balance)
    };

    console.log('Statistiques organisateur récupérées:', stats);

    res.json({
      success: true,
      data: stats
    });

  } catch (err) {
    console.error('Erreur getOrganizerStats:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques',
      error: err.message
    });
  }
}

async function getCorridorPayments(req, res) {
  const { corridorId } = req.params;
  const userId = req.user.id;

  try {
    const corridor = await pool.query('SELECT * FROM corridors WHERE id = $1', [corridorId]);
    if (corridor.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Corridor introuvable" });
    }

    if (corridor.rows[0].owner_id !== userId) {
      return res.status(403).json({ success: false, message: "Accès refusé" });
    }

    const payments = await pool.query(
      `SELECT ph.*, u.prenom, u.nom, u.email
       FROM payment_history ph
       JOIN users u ON ph.user_id = u.id
       WHERE ph.corridor_id = $1
       ORDER BY ph.payment_date DESC`,
      [corridorId]
    );

    res.json({ success: true, data: payments.rows });
  } catch (err) {
    console.error("Erreur getCorridorPayments:", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

module.exports = {
  updatePaymentStatus,
  simulatePayment,
  distributeFunds,
  getTontineBalance,
  getUserPaymentHistory,
  getPaymentOverview,
  sendPaymentReminder,
  getOrganizerBalance,
  getOrganizerStats,
  getCorridorPayments
};