const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { requireAuth } = require("../middleware/auth");



// Récupérer toutes les notifications de l'utilisateur
router.get("/", requireAuth, notificationController.getUserNotifications);

// Supprimer toutes les notifications de l'utilisateur
router.delete("/clear-all", requireAuth, notificationController.clearAllNotifications);

// Supprimer une notification spécifique
router.delete("/:notificationId", requireAuth, notificationController.deleteNotification);

module.exports = router;