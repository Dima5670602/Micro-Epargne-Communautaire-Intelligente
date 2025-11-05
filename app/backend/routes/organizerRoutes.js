const express = require("express");
const router = express.Router();
const organizerController = require("../controllers/organizerController");
const tontineController = require("../controllers/tontineController");
const corridorController = require("../controllers/corridorController");
const paymentController = require("../controllers/paymentController");
const { requireAuth, requireRole } = require("../middleware/auth");
const pool = require("../config/database");

// Routes pour récupérer les créations 
router.get("/:id/tontines", requireAuth, requireRole("organisateur"), tontineController.getUserTontines);
router.get("/:id/corridors", requireAuth, requireRole("organisateur"), corridorController.getUserCorridors);

// Nouvelles routes pour la gestion 
router.get("/requests/pending", requireAuth, requireRole("organisateur"), organizerController.getPendingRequests);
router.post("/requests/handle", requireAuth, requireRole("organisateur"), organizerController.handleParticipationRequest);

// Gestion des participants
router.get("/tontines/:tontineId/participants", requireAuth, requireRole("organisateur"), organizerController.getTontineParticipants);
router.post("/tontines/participants/add", requireAuth, requireRole("organisateur"), organizerController.addParticipantManually);
router.post("/tontines/participants/remove", requireAuth, requireRole("organisateur"), organizerController.removeParticipant);
router.post("/tontines/participants/replace", requireAuth, requireRole("organisateur"), organizerController.replaceParticipant);

// Messages groupés
router.post("/tontines/message", requireAuth, requireRole("organisateur"), organizerController.sendMessageToParticipants);

// Modification des créations
router.put("/tontines/:id", requireAuth, requireRole("organisateur"), organizerController.updateTontine);
router.put("/corridors/:id", requireAuth, requireRole("organisateur"), organizerController.updateCorridor);

// Gestion des paiements
router.post("/payments/update", requireAuth, requireRole("organisateur"), paymentController.updatePaymentStatus);
router.get("/payments/overview/:tontineId", requireAuth, requireRole("organisateur"), paymentController.getPaymentOverview);
router.post("/payments/reminder", requireAuth, requireRole("organisateur"), paymentController.sendPaymentReminder);
router.get("/payments/stats", requireAuth, requireRole("organisateur"), paymentController.getPaymentOverview);

router.get("/tontines/:tontineId/payment-tracking", requireAuth, requireRole("organisateur"), async (req, res) => {
  try {
    const { tontineId } = req.params;
    const organisateur_id = req.user.id;

    // Vérifier la propriété de la tontine
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

    // Récupérer les statistiques de paiement
    const statsQuery = `
      SELECT 
        COUNT(*) as total_participants,
        COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN funds_received = true THEN 1 END) as funds_distributed,
        COALESCE(SUM(CASE WHEN ph.status = 'completed' THEN ph.amount END), 0) as total_collected,
        COALESCE(SUM(CASE WHEN fd.amount THEN fd.amount END), 0) as total_distributed,
        (COALESCE(SUM(CASE WHEN ph.status = 'completed' THEN ph.amount END), 0) - 
         COALESCE(SUM(CASE WHEN fd.amount THEN fd.amount END), 0)) as current_balance
      FROM tontine_participants tp
      LEFT JOIN payment_history ph ON tp.tontine_id = ph.tontine_id AND tp.user_id = ph.user_id AND ph.status = 'completed'
      LEFT JOIN fund_distributions fd ON tp.tontine_id = fd.tontine_id AND tp.user_id = fd.user_id
      WHERE tp.tontine_id = $1
      GROUP BY tp.tontine_id
    `;

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
        COALESCE(SUM(CASE WHEN ph.status = 'completed' THEN ph.amount END), 0) as amount_paid,
        COALESCE(SUM(CASE WHEN fd.amount THEN fd.amount END), 0) as amount_received
      FROM tontine_participants tp
      INNER JOIN users u ON tp.user_id = u.id
      LEFT JOIN payment_history ph ON tp.tontine_id = ph.tontine_id AND tp.user_id = ph.user_id
      LEFT JOIN fund_distributions fd ON tp.tontine_id = fd.tontine_id AND tp.user_id = fd.user_id
      WHERE tp.tontine_id = $1
      GROUP BY u.id, u.prenom, u.nom, u.email, u.telephone, tp.payment_status, tp.joined_at, tp.payment_date, tp.funds_received, tp.fund_receipt_date
      ORDER BY tp.joined_at DESC
    `;

    const [statsResult, participantsResult] = await Promise.all([
      pool.query(statsQuery, [tontineId]),
      pool.query(participantsQuery, [tontineId])
    ]);

    res.json({
      success: true,
      data: {
        tontine: ownershipCheck.rows[0],
        stats: statsResult.rows[0] || {
          total_participants: 0,
          completed_payments: 0,
          pending_payments: 0,
          funds_distributed: 0,
          total_collected: 0,
          total_distributed: 0,
          current_balance: 0
        },
        participants: participantsResult.rows
      }
    });

  } catch (err) {
    console.error('Erreur payment tracking:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors du suivi des paiements',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Stats d'un corridor
router.get("/corridors/:corridorId/stats", requireAuth, requireRole("organisateur"), async (req, res) => {
  try {
    const { corridorId } = req.params;
    const userId = req.user.id;

    const corridor = await pool.query('SELECT * FROM corridors WHERE id = $1', [corridorId]);
    if (corridor.rows.length === 0) return res.status(404).json({ success: false, message: "Corridor introuvable" });
    if (corridor.rows[0].owner_id !== userId) return res.status(403).json({ success: false, message: "Accès refusé" });

    const stats = await pool.query(
      `SELECT
         COUNT(*) as total_participants,
         COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as paid_participants,
         COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_participants,
         COALESCE(SUM(amount), 0) as total_collected
       FROM corridor_participants cp
       LEFT JOIN payment_history ph ON cp.corridor_id = ph.corridor_id AND cp.user_id = ph.user_id
       WHERE cp.corridor_id = $1`,
      [corridorId]
    );

    res.json({ success: true, data: stats.rows[0] });
  } catch (err) {
    console.error("Erreur stats corridor:", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// Participants d'un corridor
router.get("/corridors/:corridorId/participants", requireAuth, requireRole("organisateur"), corridorController.getCorridorParticipants);

// Paiements d'un corridor
router.get("/corridors/:corridorId/payments", requireAuth, requireRole("organisateur"), paymentController.getCorridorPayments);

// Ajouter un participant à un corridor
router.post("/corridors/participants/add", requireAuth, requireRole("organisateur"), async (req, res) => {
  try {
    const { corridorId, userId } = req.body;
    const ownerId = req.user.id;

    const corridor = await pool.query('SELECT * FROM corridors WHERE id = $1', [corridorId]);
    if (corridor.rows.length === 0) return res.status(404).json({ success: false, message: "Corridor introuvable" });
    if (corridor.rows[0].owner_id !== ownerId) return res.status(403).json({ success: false, message: "Accès refusé" });

    await pool.query(
      `INSERT INTO corridor_participants (corridor_id, user_id, status) VALUES ($1, $2, 'active') ON CONFLICT DO NOTHING`,
      [corridorId, userId]
    );

    res.json({ success: true, message: "Participant ajouté au corridor" });
  } catch (err) {
    console.error("Erreur ajout participant corridor:", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// Solde total de l'organisateur
router.get("/balance", requireAuth, requireRole("organisateur"), paymentController.getOrganizerBalance);

// Statistiques complètes de l'organisateur
router.get("/stats", requireAuth, requireRole("organisateur"), paymentController.getOrganizerStats);

// Profil Organisateur
router.get("/profile", requireAuth, requireRole("organisateur"), organizerController.getProfile);

// Notifications
router.get("/notifications", requireAuth, requireRole("organisateur"), organizerController.getNotifications);

// Gestion des demandes de participation
router.post("/requests/handle", requireAuth, requireRole("organisateur"), organizerController.handleParticipationRequest);
router.get("/requests/pending", requireAuth, requireRole("organisateur"), organizerController.getPendingRequests);

// Voir Tontines & Corridors Actifs
router.get("/tontines/active", requireAuth, requireRole("organisateur"), organizerController.getActiveTontines);
router.get("/corridors/active", requireAuth, requireRole("organisateur"), organizerController.getActiveCorridors);

// Voir tous les participants
router.get("/participants", requireAuth, requireRole("organisateur"), organizerController.getAllParticipants);

// Gestion Tour de Table
router.post("/tontines/payment-round", requireAuth, requireRole("organisateur"), organizerController.managePaymentRound);

module.exports = router;