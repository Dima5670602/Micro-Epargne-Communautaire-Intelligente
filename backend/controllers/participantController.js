const participantModel = require("../models/usersModel");
const corridorModel = require("../models/corridorModel");
const tontineModel = require("../models/tontineModel");
const { createNotification } = require("./notificationController");
const { MAX_FREE_INTEGRATIONS, MAX_PREMIUM_INTEGRATIONS } = require("../config/constants");

async function joinCorridor(req, res) {
  const user = req.user;
  const { corridorId } = req.body;
  try {
    const count = await participantModel.countUserIntegrations(user.id);
    const limit = user.isPremium ? MAX_PREMIUM_INTEGRATIONS : MAX_FREE_INTEGRATIONS;
    if (count >= limit) return res.status(403).json({ success: false, message: "Limite d'intégration atteinte" });

    const corridor = await corridorModel.findById(corridorId);
    if (!corridor) return res.status(404).json({ success: false, message: "Corridor introuvable" });

    // Créer une demande de participation
    const pool = require("../config/database");
    await pool.query(
      'INSERT INTO participation_requests (user_id, corridor_id, status) VALUES ($1, $2, $3)',
      [user.id, corridorId, 'pending']
    );

    // Notifier l'organisateur
    await createNotification(
      corridor.owner_id,
      'Nouvelle demande de participation',
      `${user.prenom} ${user.nom} souhaite rejoindre votre corridor "${corridor.name}"`,
      { corridorId: corridorId, userId: user.id, type: 'participation_request' }
    );

    res.json({ success: true, message: "Demande envoyée" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

async function listAvailable(req, res) {
  try {
    const corridors = await corridorModel.listAvailable();
    const tontines = await tontineModel.listAvailable();
    res.json({ success: true, data: { corridors, tontines } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

// Récupérer les tontines où l'utilisateur est participant
async function getMyTontines(req, res) {
  try {
    const userId = req.user.id;
    const pool = require("../config/database");
    
    const query = `
      SELECT 
        t.*,
        u.prenom as owner_prenom,
        u.nom as owner_nom,
        tp.joined_at,
        tp.payment_status
      FROM tontine_participants tp
      INNER JOIN tontines t ON tp.tontine_id = t.id
      INNER JOIN users u ON t.owner_id = u.id
      WHERE tp.user_id = $1
      ORDER BY tp.joined_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur getMyTontines:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

// Récupérer les participants d'une tontine (visible par les membres)
async function getTontineMembers(req, res) {
  try {
    const { tontineId } = req.params;
    const userId = req.user.id;

    // Vérifier que l'utilisateur est bien participant de cette tontine
    const membershipCheck = await participantModel.checkTontineMembership(userId, tontineId);
    if (!membershipCheck) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const pool = require("../config/database");
    const query = `
      SELECT 
        u.prenom,
        u.nom,
        u.email,
        tp.payment_status,
        tp.joined_at
      FROM tontine_participants tp
      INNER JOIN users u ON tp.user_id = u.id
      WHERE tp.tontine_id = $1
      ORDER BY tp.joined_at DESC
    `;
    
    const result = await pool.query(query, [tontineId]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur getTontineMembers:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

module.exports = {
  joinCorridor,
  listAvailable,
  getMyTontines,
  getTontineMembers
};