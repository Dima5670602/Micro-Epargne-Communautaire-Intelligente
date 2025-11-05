const express = require("express");
const router = express.Router();
const usersModel = require("../models/usersModel");
const { requireAuth } = require("../middleware/auth");
const pool = require("../config/database");

router.get("/", requireAuth, async (req, res) => {
  try {
    const user = await usersModel.findById(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

router.put("/update", requireAuth, async (req, res) => {
  try {
    const { prenom, nom, email, telephone } = req.body;
    
    // Validation
    if (!prenom || !nom || !email) {
      return res.status(400).json({ 
        success: false, 
        message: "Le prénom, le nom et l'email sont obligatoires" 
      });
    }
    
    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    const existingUser = await pool.query(
      `SELECT id FROM users WHERE email = $1 AND id != $2`,
      [email, req.user.id]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cet email est déjà utilisé par un autre utilisateur"
      });
    }
    
    // Mettre à jour l'utilisateur
    const result = await pool.query(
      `UPDATE users 
       SET prenom = $1, nom = $2, email = $3, telephone = $4, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5 
       RETURNING id, prenom, nom, email, telephone, role, is_premium`,
      [prenom, nom, email, telephone, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé"
      });
    }
    
    res.json({
      success: true,
      message: "Profil mis à jour avec succès",
      data: result.rows[0]
    });
    
  } catch (err) {
    console.error("Erreur mise à jour profil:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors de la mise à jour du profil" 
    });
  }
});

router.post("/subscribe", requireAuth, async (req, res) => {
  // subscription logic (placeholder)
  const { plan } = req.body;
  try {
    await pool.query(`UPDATE users SET is_premium = true WHERE id = $1`, [req.user.id]);
    res.json({ success: true, message: "Abonnement activé" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;