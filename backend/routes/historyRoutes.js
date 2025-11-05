const express = require("express");
const router = express.Router();

// controllers
const analyticsController = require('../controllers/analyticsController');
const historyController = require('../controllers/historyController');

// routes
router.get("/history/user/:userId", historyController.getUserHistory);

module.exports = router;
