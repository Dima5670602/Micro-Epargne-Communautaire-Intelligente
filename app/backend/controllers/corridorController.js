const corridorModel = require("../models/corridorModel");
const { MAX_FREE_CREATIONS, MAX_PREMIUM_CREATIONS } = require("../config/constants");

// MÉTHODE : Récupérer tous les corridors de l'utilisateur
async function getUserCorridors(req, res) {
  try {
    console.log(" Récupération des corridors pour l'utilisateur:", req.user.id);
    
    const corridors = await corridorModel.findByOwner(req.user.id);
    
    console.log(` ${corridors.length} corridor(s) trouvé(s) pour l'utilisateur ${req.user.id}`);

    res.json({
      success: true,
      data: corridors,
      message: `${corridors.length} corridor(s) trouvé(s)`
    });

  } catch (err) {
    console.error(" Erreur récupération corridors:", err);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des corridors"
    });
  }
}


async function createCorridor(req, res) {
  console.log(" CREATE CORRIDOR - Début");
  console.log(" User:", req.user);
  console.log(" Body:", req.body);
  
  const user = req.user;
  const { name, bareme, commission, phone } = req.body;

  try {
    // Validation des données
    if (!name || !bareme) {
      console.error(" Validation échouée: name ou bareme manquant");
      return res.status(400).json({ 
        success: false, 
        message: "Le nom et le barème sont obligatoires" 
      });
    }

    console.log(" Comptage des corridors existants...");
    const count = await corridorModel.countUserCorridors(user.id);
    console.log(` Corridors existants: ${count}`);
    
    const limit = user.isPremium ? MAX_PREMIUM_CREATIONS : MAX_FREE_CREATIONS;
    console.log(`Limite: ${limit} (Premium: ${user.isPremium})`);

    if (count >= limit) {
      console.warn("Limite atteinte");
      return res.status(403).json({ 
        success: false, 
        message: "Limite de création atteinte" 
      });
    }

    console.log("Création du corridor en BDD...");
    const corridor = await corridorModel.create({
      owner_id: user.id,
      name,
      bareme,
      commission,
      phone,
    });

    console.log("Corridor créé avec succès:", corridor);
    res.json({ success: true, data: corridor });
    
  } catch (err) {
    console.error("Erreur serveur complète:", err);
    console.error("Stack trace:", err.stack);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}

/**
 * Détails d'un corridor
 */
async function getCorridorDetails(req, res) {
  const id = req.params.id;
  console.log(`GET CORRIDOR ${id}`);
  
  try {
    const details = await corridorModel.findById(id);
    if (!details) {
      console.warn(`Corridor ${id} introuvable`);
      return res.status(404).json({ 
        success: false, 
        message: "Corridor introuvable" 
      });
    }
    
    console.log("Corridor trouvé:", details);
    res.json({ success: true, data: details });
  } catch (err) {
    console.error("Erreur serveur:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur" 
    });
  }
}

/**
 * Supprime un corridor
 */
async function deleteCorridor(req, res) {
  const id = req.params.id;
  const user = req.user;
  console.log(`DELETE CORRIDOR ${id} par user ${user.id}`);
  
  try {
    const corridor = await corridorModel.findById(id);
    
    if (!corridor) {
      console.warn(`Corridor ${id} introuvable`);
      return res.status(404).json({ 
        success: false, 
        message: "Corridor introuvable" 
      });
    }
    
    if (corridor.owner_id !== user.id) {
      console.warn(`User ${user.id} n'est pas le propriétaire du corridor ${id}`);
      return res.status(403).json({ 
        success: false, 
        message: "Accès refusé" 
      });
    }

    await corridorModel.deleteById(id);
    console.log(`Corridor ${id} supprimé`);
    res.json({ success: true, message: "Corridor supprimé avec succès" });
    
  } catch (err) {
    console.error("Erreur serveur:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur" 
    });
  }
}

// Récupérer les participants d’un corridor
async function getCorridorParticipants(req, res) {
  const corridorId = req.params.id;
  const userId = req.user.id;

  try {
    const corridor = await corridorModel.findById(corridorId);
    if (!corridor) return res.status(404).json({ success: false, message: "Corridor introuvable" });
    if (corridor.owner_id !== userId) return res.status(403).json({ success: false, message: "Accès refusé" });

    const participants = await corridorModel.getParticipants(corridorId);
    res.json({ success: true, data: participants });
  } catch (err) {
    console.error("Erreur getCorridorParticipants:", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

// Ajouter un participant à un corridor
async function addCorridorParticipant(req, res) {
  const { corridorId, userId } = req.body;
  const ownerId = req.user.id;

  try {
    const corridor = await corridorModel.findById(corridorId);
    if (!corridor) return res.status(404).json({ success: false, message: "Corridor introuvable" });
    if (corridor.owner_id !== ownerId) return res.status(403).json({ success: false, message: "Accès refusé" });

    await pool.query(
      `INSERT INTO corridor_participants (corridor_id, user_id, status) VALUES ($1, $2, 'active') ON CONFLICT DO NOTHING`,
      [corridorId, userId]
    );

    res.json({ success: true, message: "Participant ajouté au corridor" });
  } catch (err) {
    console.error("Erreur addCorridorParticipant:", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
}

module.exports = {
  getCorridorParticipants,
  addCorridorParticipant,
  getUserCorridors,
  createCorridor,
  getCorridorDetails,
  deleteCorridor,
};