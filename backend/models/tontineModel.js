const pool = require("../config/database");

async function create({ owner_id, name, description, date, bareme, commission, phone }) {
  console.log("tontineModel.create - Données reçues:", {
    owner_id, name, description, date, bareme, commission, phone
  });
  
  const baremeStr = bareme ? String(bareme) : null;
  
  const { rows } = await pool.query(
    `INSERT INTO tontines(owner_id, name, description, date, bareme, commission, phone) 
     VALUES($1,$2,$3,$4,$5,$6,$7) 
     RETURNING *`,
    [owner_id, name, description, date, baremeStr, commission, phone]
  );
  
  console.log("Tontine créée:", rows[0]);
  return rows[0];
}

async function setToken(tontineId, token) {
  console.log(`🔑 Définition du token pour tontine ${tontineId}: ${token}`);
  await pool.query(
    `UPDATE tontines SET token = $1 WHERE id = $2`, 
    [token, tontineId]
  );
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM tontines WHERE id = $1`, 
    [id]
  );
  return rows[0];
}

async function findByToken(token) {
  const { rows } = await pool.query(
    `SELECT * FROM tontines WHERE token = $1`, 
    [token]
  );
  return rows[0];
}

async function countUserTontines(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM tontines WHERE owner_id = $1`, 
    [userId]
  );
  return parseInt(rows[0].count, 10);
}

async function countParticipants(tontineId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM tontine_participants WHERE tontine_id = $1`, 
    [tontineId]
  );
  return parseInt(rows[0].count, 10);
}

async function addParticipant(tontineId, userId) {
  await pool.query(
    `INSERT INTO tontine_participants(tontine_id, user_id) 
     VALUES($1,$2)
     ON CONFLICT (tontine_id, user_id) DO NOTHING`, 
    [tontineId, userId]
  );
}

async function listAvailable() {
  const { rows } = await pool.query(
    `SELECT 
      t.*,
      u.prenom as owner_prenom,
      u.nom as owner_nom
     FROM tontines t 
     INNER JOIN users u ON t.owner_id = u.id
     WHERE t.active = true 
     ORDER BY t.created_at DESC`
  );
  return rows;
}

async function findByOwner(ownerId) {
  const { rows } = await pool.query(
    `SELECT * FROM tontines WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId]
  );
  return rows;
}

// Mettre à jour une tontine
async function update(tontineId, updates) {
  const { name, description, date, bareme, commission, phone } = updates;
  
  const setClause = [];
  const values = [];
  let paramCount = 1;

  if (name !== undefined) {
    setClause.push(`name = $${paramCount}`);
    values.push(name);
    paramCount++;
  }
  if (description !== undefined) {
    setClause.push(`description = $${paramCount}`);
    values.push(description);
    paramCount++;
  }
  if (date !== undefined) {
    setClause.push(`date = $${paramCount}`);
    values.push(date);
    paramCount++;
  }
  if (bareme !== undefined) {
    setClause.push(`bareme = $${paramCount}`);
    values.push(String(bareme));
    paramCount++;
  }
  if (commission !== undefined) {
    setClause.push(`commission = $${paramCount}`);
    values.push(commission);
    paramCount++;
  }
  if (phone !== undefined) {
    setClause.push(`phone = $${paramCount}`);
    values.push(phone);
    paramCount++;
  }

  if (setClause.length === 0) {
    throw new Error("Aucune donnée à mettre à jour");
  }

  setClause.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(tontineId);

  const query = `
    UPDATE tontines 
    SET ${setClause.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;

  const { rows } = await pool.query(query, values);
  return rows[0];
}

// Récupérer les participants avec détails
async function getParticipantsWithDetails(tontineId) {
  const { rows } = await pool.query(
    `SELECT 
      tp.*,
      u.prenom,
      u.nom,
      u.email,
      u.telephone
     FROM tontine_participants tp
     INNER JOIN users u ON tp.user_id = u.id
     WHERE tp.tontine_id = $1
     ORDER BY tp.joined_at DESC`,
    [tontineId]
  );
  return rows;
}

module.exports = {
  create,
  setToken,
  findById,
  findByToken,
  countUserTontines,
  countParticipants,
  addParticipant,
  listAvailable,
  findByOwner,
  update,
  getParticipantsWithDetails
};