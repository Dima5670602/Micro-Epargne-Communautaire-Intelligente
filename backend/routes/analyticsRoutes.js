const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const { requireAuth } = require("../middleware/auth");

router.get("/trend", requireAuth, analyticsController.getActivityTrend);
router.get("/history/:userId", requireAuth, analyticsController.getUserHistory);

router.get("/engagement/:userId", requireAuth, analyticsController.getUserEngagement);
router.get("/platform", requireAuth, analyticsController.getPlatformAnalytics);

module.exports = router;