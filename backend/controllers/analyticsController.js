const analyticsModel = require("../models/analyticsModel");

async function getUserHistory(req, res) {
  const userId = req.params.userId;
  try {
    const history = await analyticsModel.getUserPayments(userId);
    res.json({ success: true, data: history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

async function getActivityTrend(req, res) {
  try {
    const trend = await analyticsModel.getActivityTrend();
    res.json({ success: true, data: trend });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

// FONCTION : Récupérer les statistiques d'engagement utilisateur
async function getUserEngagement(req, res) {
  const userId = req.params.userId;
  try {
    const engagement = await analyticsModel.getUserEngagementStats(userId);
    res.json({ success: true, data: engagement });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

// FONCTION : Récupérer les statistiques de plateforme pour l'organisateur
async function getPlatformAnalytics(req, res) {
  const organisateurId = req.user.id;
  try {
    const analytics = await analyticsModel.getPlatformAnalytics(organisateurId);
    res.json({ success: true, data: analytics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

module.exports = {
  getUserHistory,
  getActivityTrend,
  getUserEngagement,
  getPlatformAnalytics,
};