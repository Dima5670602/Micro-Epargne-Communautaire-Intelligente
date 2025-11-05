const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { requireAuth, requireRole } = require("../middleware/auth");

// Routes pour les participants
router.post("/simulate", requireAuth, paymentController.simulatePayment);
router.get("/user/history", requireAuth, paymentController.getUserPaymentHistory);

// Routes pour les organisateurs
router.post("/update-status", requireAuth, requireRole("organisateur"), paymentController.updatePaymentStatus);
router.post("/distribute", requireAuth, requireRole("organisateur"), paymentController.distributeFunds);
router.get("/balance/:tontineId", requireAuth, requireRole("organisateur"), paymentController.getTontineBalance);
router.get("/overview/:tontineId", requireAuth, requireRole("organisateur"), paymentController.getPaymentOverview);
router.post("/reminder", requireAuth, requireRole("organisateur"), paymentController.sendPaymentReminder);


// Récupère le solde total de l'organisateur
router.get("/organizer/balance", requireAuth, requireRole("organisateur"), paymentController.getOrganizerBalance);

// Récupère les statistiques complètes de l'organisateur
router.get("/organizer/stats", requireAuth, requireRole("organisateur"), paymentController.getOrganizerStats);

module.exports = router;