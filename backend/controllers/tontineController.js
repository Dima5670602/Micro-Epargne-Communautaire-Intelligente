const tontineModel = require("../models/tontineModel");
const tokenUtil = require("../utils/token");
const { MAX_FREE_CREATIONS, MAX_PREMIUM_CREATIONS } = require("../config/constants");

// NOUVELLE MÉTHODE : Récupérer toutes les tontines de l'utilisateur
async function getUserTontines(req, res) {
  try {
    console.log("📥 Récupération des tontines pour l'utilisateur:", req.user.id);
    
    // CORRECTION : Utiliser findByOwner au lieu de findByUserId
    const tontines = await tontineModel.findByOwner(req.user.id);
    
    console.log(`✅ ${tontines.length} tontine(s) trouvée(s) pour l'utilisateur ${req.user.id}`);

    res.json({
      success: true,
      data: tontines,
      message: `${tontines.length} tontine(s) trouvée(s)`
    });

  } catch (err) {
    console.error("❌ Erreur récupération tontines:", err);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des tontines"
    });
  }
}

async function createTontine(req, res) {
  const user = req.user;
  const { name, description, date, bareme, commission, phone } = req.body;
  
  console.log("🎯 CREATE TONTINE - Début");
  console.log("👤 User:", user);
  console.log("📦 Body:", req.body);
  
  try {
    const count = await tontineModel.countUserTontines(user.id);
    const limit = user.isPremium ? MAX_PREMIUM_CREATIONS : MAX_FREE_CREATIONS;
    
    console.log(`📊 Tontines existantes: ${count}, Limite: ${limit}`);
    
    if (count >= limit) {
      console.warn("⚠️ Limite de création atteinte");
      return res.status(403).json({ 
        success: false, 
        message: "Limite de création atteinte" 
      });
    }

    console.log("💾 Création de la tontine en BDD...");
    const created = await tontineModel.create({
      owner_id: user.id,
      name,
      description,
      date,
      bareme,
      commission,
      phone
    });

    // ✅ génération du token
    console.log("🔑 Génération du token...");
    const token = tokenUtil.generateTokenForTontine(created.id);
    await tontineModel.setToken(created.id, token);

    const details = await tontineModel.findById(created.id);
    console.log("✅ Tontine créée avec succès:", details);
    
    res.json({ success: true, data: details });
  } catch (err) {
    console.error("❌ Erreur création tontine:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur" 
    });
  }
}

async function getTontineDetails(req, res) {
  const id = req.params.id;
  console.log(`🔍 GET TONTINE ${id}`);
  
  try {
    const details = await tontineModel.findById(id);
    if (!details) {
      console.warn(`⚠️ Tontine ${id} introuvable`);
      return res.status(404).json({ 
        success: false, 
        message: "Tontine introuvable" 
      });
    }
    
    console.log("✅ Tontine trouvée:", details);
    res.json({ success: true, data: details });
  } catch (err) {
    console.error("❌ Erreur serveur:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur" 
    });
  }
}

// NOUVELLE MÉTHODE : Supprimer une tontine
async function deleteTontine(req, res) {
  const id = req.params.id;
  const user = req.user;
  
  console.log(`🗑️ DELETE TONTINE ${id} par user ${user.id}`);
  
  try {
    // Vérifier que la tontine existe
    const tontine = await tontineModel.findById(id);
    
    if (!tontine) {
      console.warn(`⚠️ Tontine ${id} introuvable`);
      return res.status(404).json({ 
        success: false, 
        message: "Tontine introuvable" 
      });
    }
    
    // Vérifier que l'utilisateur est le propriétaire
    if (tontine.owner_id !== user.id) {
      console.warn(`⚠️ User ${user.id} n'est pas le propriétaire de la tontine ${id}`);
      return res.status(403).json({ 
        success: false, 
        message: "Accès refusé - Vous n'êtes pas le propriétaire de cette tontine" 
      });
    }

    // Pour la suppression, on va directement utiliser une requête SQL simple
    // puisque nous n'avons pas de méthode deleteById dans le modèle
    const pool = require("../config/database"); // Import local seulement si nécessaire
    
    // Supprimer d'abord les participants (si la table existe)
    try {
      await pool.query(
        `DELETE FROM tontine_participants WHERE tontine_id = $1`, 
        [id]
      );
      console.log(`✅ Participants de la tontine ${id} supprimés`);
    } catch (participantError) {
      console.log("ℹ️ Aucun participant à supprimer ou table inexistante");
    }

    // Supprimer la tontine
    const { rowCount } = await pool.query(
      `DELETE FROM tontines WHERE id = $1`, 
      [id]
    );
    
    if (rowCount > 0) {
      console.log(`✅ Tontine ${id} supprimée avec succès`);
      res.json({ 
        success: true, 
        message: "Tontine supprimée avec succès" 
      });
    } else {
      console.warn(`⚠️ Aucune tontine supprimée (id: ${id})`);
      res.status(404).json({ 
        success: false, 
        message: "Tontine introuvable" 
      });
    }
    
  } catch (err) {
    console.error("❌ Erreur suppression tontine:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur lors de la suppression de la tontine" 
    });
  }
}

async function joinByToken(req, res) {
  const user = req.user;
  const { token } = req.body;
  
  console.log(`🔗 JOIN TONTINE avec token: ${token}`);
  
  try {
    const tontine = await tontineModel.findByToken(token);
    if (!tontine) {
      console.warn(`⚠️ Tontine avec token ${token} introuvable`);
      return res.status(404).json({ 
        success: false, 
        message: "Tontine introuvable" 
      });
    }

    await tontineModel.addParticipant(tontine.id, user.id);
    console.log(`✅ User ${user.id} a rejoint la tontine ${tontine.id}`);
    
    res.json({ 
      success: true, 
      message: "Rejoint avec succès", 
      data: tontine 
    });
  } catch (err) {
    console.error("❌ Erreur rejoindre tontine:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur" 
    });
  }
}

// NOUVELLE MÉTHODE : Demander à rejoindre une tontine
async function requestJoinTontine(req, res) {
  const user = req.user;
  const { tontineId } = req.body;
  
  console.log(`📨 Demande de participation à la tontine ${tontineId} par user ${user.id}`);
  
  try {
    // Vérifier que la tontine existe
    const tontine = await tontineModel.findById(tontineId);
    if (!tontine) {
      console.warn(`⚠️ Tontine ${tontineId} introuvable`);
      return res.status(404).json({ 
        success: false, 
        message: "Tontine introuvable" 
      });
    }

    // Vérifier si l'utilisateur est déjà participant
    const pool = require("../config/database");
    const participantCheck = await pool.query(
      'SELECT * FROM tontine_participants WHERE tontine_id = $1 AND user_id = $2',
      [tontineId, user.id]
    );

    if (participantCheck.rows.length > 0) {
      console.warn(`⚠️ User ${user.id} est déjà participant de la tontine ${tontineId}`);
      return res.status(400).json({ 
        success: false, 
        message: "Vous êtes déjà participant de cette tontine" 
      });
    }

    // Créer une demande de participation (vous devrez créer cette table)
    try {
      await pool.query(
        `INSERT INTO participation_requests (tontine_id, user_id, status, created_at) 
         VALUES ($1, $2, 'pending', CURRENT_TIMESTAMP)`,
        [tontineId, user.id]
      );
      
      console.log(`✅ Demande de participation créée pour la tontine ${tontineId}`);
      
      res.json({ 
        success: true, 
        message: "Votre demande de participation a été envoyée à l'organisateur" 
      });
      
    } catch (dbError) {
      // Si la table n'existe pas, on ajoute directement le participant
      console.log("ℹ️ Table participation_requests non trouvée, ajout direct comme participant");
      
      await tontineModel.addParticipant(tontineId, user.id);
      console.log(`✅ User ${user.id} ajouté directement à la tontine ${tontineId}`);
      
      res.json({ 
        success: true, 
        message: "Vous avez rejoint la tontine avec succès" 
      });
    }
    
  } catch (err) {
    console.error("❌ Erreur demande participation tontine:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur lors de la demande de participation" 
    });
  }
}

// Export des fonctions
module.exports = {
  getUserTontines,
  createTontine,
  getTontineDetails,
  deleteTontine,
  joinByToken,
  requestJoinTontine
};