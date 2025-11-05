const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const { requireAuth } = require("../middleware/auth");



// Routes pour les messages
router.post("/send", requireAuth, messageController.sendMessage);
router.get("/conversation/:userId", requireAuth, messageController.getConversation);
router.get("/conversations", requireAuth, messageController.getUserConversations);
router.post("/read", requireAuth, messageController.markAsRead);
router.get("/unread", requireAuth, messageController.getUnreadMessages);

// Routes pour la suppression
router.delete("/clear-all", requireAuth, messageController.clearAllMessages);
router.delete("/conversation/:userId", requireAuth, messageController.deleteConversation);
router.delete("/:messageId", requireAuth, messageController.deleteMessage);

module.exports = router;