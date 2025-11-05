const express = require("express");
const router = express.Router();
const participantController = require("../controllers/participantController");
const { requireAuth } = require("../middleware/auth");
const pool = require("../config/database");


// Routes existantes
router.post("/join/corridor", requireAuth, participantController.joinCorridor);
router.get("/available", requireAuth, participantController.listAvailable);
router.get("/my-tontines", requireAuth, participantController.getMyTontines);
router.get("/tontines/:tontineId/members", requireAuth, participantController.getTontineMembers);

// Récupérer les soldes du participant
router.get("/balances", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(` Chargement des soldes pour l'utilisateur ${userId}`);
    
    // Version simplifiée sans corridor_id
    const balances = await pool.query(`
      SELECT 
        COALESCE((
          SELECT SUM(amount) 
          FROM payment_history 
          WHERE user_id = $1 AND status = 'completed'
        ), 0) as tontine_balance,
        0 as corridor_balance
    `, [userId]);

    res.json({
      success: true,
      data: balances.rows[0] || { tontine_balance: 0, corridor_balance: 0 }
    });
  } catch (err) {
    console.error('Erreur balances:', err);
    res.json({ 
      success: true, 
      data: { tontine_balance: 0, corridor_balance: 0 }
    });
  }
});

// Récupérer les prochains paiements
router.get("/upcoming-payments", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`Chargement des paiements pour l'utilisateur ${userId}`);
    
    // Version simplifiée sans corridor_id
    const upcomingPayments = await pool.query(`
      SELECT 
        t.id,
        t.name,
        'tontine' as type,
        COALESCE(t.montant_par_participant, 0) as amount,
        CURRENT_DATE + INTERVAL '30 days' as due_date
      FROM tontine_participants tp
      INNER JOIN tontines t ON tp.tontine_id = t.id
      WHERE tp.user_id = $1 AND tp.payment_status = 'pending'
      LIMIT 10
    `, [userId]);

    res.json({
      success: true,
      data: upcomingPayments.rows
    });
  } catch (err) {
    console.error('Erreur upcoming-payments:', err);
    res.json({ 
      success: true, 
      data: []
    });
  }
});

// Récupérer les transactions récentes
router.get("/transactions", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`Chargement des transactions pour l'utilisateur ${userId}`);
    
    // Version simplifiée sans corridor_id
    const transactions = await pool.query(`
      SELECT 
        ph.id,
        'payment' as type,
        ph.amount,
        ph.payment_date as date,
        t.name as description,
        ph.status,
        'debit' as transaction_type
      FROM payment_history ph
      INNER JOIN tontines t ON ph.tontine_id = t.id
      WHERE ph.user_id = $1
      ORDER BY ph.payment_date DESC
      LIMIT 10
    `, [userId]);

    res.json({
      success: true,
      data: transactions.rows
    });
  } catch (err) {
    console.error('Erreur transactions:', err);
    res.json({ 
      success: true, 
      data: []
    });
  }
});

// Récupérer l'historique des paiements
router.get("/payment-history", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`Chargement de l'historique pour l'utilisateur ${userId}`);
    
    // simplifiée sans corridor_id
    const paymentHistory = await pool.query(`
      SELECT 
        ph.id,
        t.name as item_name,
        'tontine' as item_type,
        ph.amount,
        ph.payment_date,
        ph.status,
        ph.payment_method
      FROM payment_history ph
      INNER JOIN tontines t ON ph.tontine_id = t.id
      WHERE ph.user_id = $1
      ORDER BY ph.payment_date DESC
      LIMIT 20
    `, [userId]);

    res.json({
      success: true,
      data: paymentHistory.rows
    });
  } catch (err) {
    console.error('Erreur payment-history:', err);
    res.json({ 
      success: true, 
      data: []
    });
  }
});

// Effectuer un paiement
router.post("/pay", requireAuth, async (req, res) => {
  try {
    const { item_id, item_type, amount, method } = req.body;
    const userId = req.user.id;

    console.log(`Paiement: user=${userId}, item=${item_id}, type=${item_type}, amount=${amount}`);

    const transactionId = `pay_${Date.now()}_${userId}`;

    if (item_type === 'tontine') {
      await pool.query(`
        INSERT INTO payment_history (tontine_id, user_id, amount, status, payment_method, transaction_id, payment_date)
        VALUES ($1, $2, $3, 'completed', $4, $5, CURRENT_TIMESTAMP)
      `, [item_id, userId, amount, method, transactionId]);

      await pool.query(`
        UPDATE tontine_participants 
        SET payment_status = 'completed', payment_date = CURRENT_TIMESTAMP 
        WHERE tontine_id = $1 AND user_id = $2
      `, [item_id, userId]);

    } else if (item_type === 'corridor') {
      // Pour les corridors, on utilise item_id comme corridor_id
      await pool.query(`
        INSERT INTO payment_history (tontine_id, user_id, amount, status, payment_method, transaction_id, payment_date)
        VALUES (NULL, $1, $2, 'completed', $3, $4, CURRENT_TIMESTAMP)
      `, [userId, amount, method, transactionId]);

      await pool.query(`
        UPDATE corridor_participants 
        SET payment_status = 'completed', payment_date = CURRENT_TIMESTAMP 
        WHERE corridor_id = $1 AND user_id = $2
      `, [item_id, userId]);
    }

    res.json({
      success: true,
      message: "Paiement effectué avec succès",
      data: { 
        transaction_id: transactionId,
        amount: amount,
        method: method
      }
    });
  } catch (err) {
    console.error('Erreur pay:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du traitement du paiement' 
    });
  }
});

// Vérifier si le participant peut recevoir des fonds
router.get("/fund-receipt", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(` Vérification fonds pour l'utilisateur ${userId}`);
    
    res.json({
      success: true,
      data: {
        can_receive: false,
        message: "Fonctionnalité en cours de développement",
        next_recipient: "Non déterminé"
      }
    });
  } catch (err) {
    console.error(' Erreur fund-receipt:', err);
    res.json({ 
      success: true,
      data: { 
        can_receive: false, 
        message: "Service temporairement indisponible" 
      }
    });
  }
});

// Recevoir des fonds (simulation)
router.post("/receive-funds", requireAuth, async (req, res) => {
  try {
    const { item_id, item_type } = req.body;
    const userId = req.user.id;

    console.log(` Réception fonds: user=${userId}, item=${item_id}, type=${item_type}`);

    res.json({
      success: true,
      message: "Réception de fonds simulée avec succès",
      data: { 
        amount: 0, 
        item_name: "Simulation" 
      }
    });
  } catch (err) {
    console.error(' Erreur receive-funds:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la réception des fonds' 
    });
  }
});

module.exports = router;