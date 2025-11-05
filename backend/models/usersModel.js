const pool = require("../config/database");
const bcrypt = require("bcrypt");

async function createUser(nom, prenom, email, password, role) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (nom, prenom, email, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nom, prenom, email, hashedPassword, role]
    );
    return result.rows[0];
  } catch (err) {
    console.error("Erreur lors de la création d'utilisateur :", err);
    throw err;
  }
}

async function findByEmail(email) {
  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0];
  } catch (err) {
    console.error("Erreur lors de la recherche d'utilisateur :", err);
    throw err;
  }
}

async function findById(id) {
  try {
    const result = await pool.query(
      `SELECT id, nom, prenom, email, role, is_premium FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  } catch (err) {
    console.error("Erreur lors de la recherche par ID :", err);
    throw err;
  }
}

async function countUserIntegrations(userId) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM tontine_participants WHERE user_id = $1`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  } catch (err) {
    console.error("Erreur lors du comptage des intégrations :", err);
    throw err;
  }
}

async function joinCorridor(userId, corridorId) {
  try {
    await pool.query(
      `INSERT INTO corridor_participants (user_id, corridor_id, status) 
       VALUES ($1, $2, 'pending')
       ON CONFLICT (user_id, corridor_id) DO NOTHING`,
      [userId, corridorId]
    );
  } catch (err) {
    console.error("Erreur lors de la jointure au corridor :", err);
    throw err;
  }
}

// Vérifier l'appartenance à une tontine
async function checkTontineMembership(userId, tontineId) {
  try {
    const result = await pool.query(
      `SELECT 1 FROM tontine_participants WHERE user_id = $1 AND tontine_id = $2`,
      [userId, tontineId]
    );
    return result.rows.length > 0;
  } catch (err) {
    console.error("Erreur vérification appartenance tontine :", err);
    throw err;
  }
}

// Vérifier l'appartenance à un corridor
async function checkCorridorMembership(userId, corridorId) {
  try {
    const result = await pool.query(
      `SELECT 1 FROM corridor_participants WHERE user_id = $1 AND corridor_id = $2 AND status = 'active'`,
      [userId, corridorId]
    );
    return result.rows.length > 0;
  } catch (err) {
    console.error("Erreur vérification appartenance corridor :", err);
    throw err;
  }
}

// Récupérer les informations utilisateur pour l'affichage
async function getUserProfile(userId) {
  try {
    const result = await pool.query(
      `SELECT id, nom, prenom, email, telephone, role, is_premium, created_at 
       FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0];
  } catch (err) {
    console.error("Erreur récupération profil utilisateur :", err);
    throw err;
  }
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  countUserIntegrations,
  joinCorridor,
  checkTontineMembership,
  checkCorridorMembership,
  getUserProfile
};