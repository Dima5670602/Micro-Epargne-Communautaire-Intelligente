const pool = require("../config/database");

async function create({ owner_id, name, bareme, commission, phone }) {
  const baremeStr = bareme ? String(bareme) : null;
  
  const { rows } = await pool.query(
    `INSERT INTO corridors(owner_id, name, bareme, commission, phone) 
     VALUES($1,$2,$3,$4,$5) 
     RETURNING *`,
    [owner_id, name, baremeStr, commission, phone]
  );
  return rows[0];
}

async function countUserCorridors(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM corridors WHERE owner_id = $1`, 
    [userId]
  );
  return parseInt(rows[0].count, 10);
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM corridors WHERE id = $1`, 
    [id]
  );
  return rows[0];
}

async function listAvailable() {
  const { rows } = await pool.query(
    `SELECT 
      c.*,
      u.prenom as owner_prenom,
      u.nom as owner_nom
     FROM corridors c 
     INNER JOIN users u ON c.owner_id = u.id
     WHERE c.active = true 
     ORDER BY c.created_at DESC`
  );
  return rows;
}

async function deleteById(id) {
  await pool.query(
    `DELETE FROM corridors WHERE id = $1`, 
    [id]
  );
}

async function findByOwner(ownerId) {
  const { rows } = await pool.query(
    `SELECT * FROM corridors WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId]
  );
  return rows;
}

// NOUVELLE MÉTHODE : Mettre à jour un corridor
async function update(corridorId, updates) {
  const { name, bareme, commission, phone } = updates;
  
  const setClause = [];
  const values = [];
  let paramCount = 1;

  if (name !== undefined) {
    setClause.push(`name = $${paramCount}`);
    values.push(name);
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
  values.push(corridorId);

  const query = `
    UPDATE corridors 
    SET ${setClause.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;

  const { rows } = await pool.query(query, values);
  return rows[0];
}

// NOUVELLE MÉTHODE : Récupérer les participants d'un corridor
async function getParticipants(corridorId) {
  const { rows } = await pool.query(
    `SELECT 
      cp.*,
      u.prenom,
      u.nom,
      u.email,
      u.telephone
     FROM corridor_participants cp
     INNER JOIN users u ON cp.user_id = u.id
     WHERE cp.corridor_id = $1
     ORDER BY cp.joined_at DESC`,
    [corridorId]
  );
  return rows;
}

async function getCorridorStats(corridorId) {
  const result = await pool.query(
    `SELECT
       COUNT(*) as total_participants,
       COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as paid_participants,
       COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_participants,
       COALESCE(SUM(amount), 0) as total_collected
     FROM corridor_participants cp
     LEFT JOIN payment_history ph ON cp.corridor_id = ph.corridor_id AND cp.user_id = ph.user_id
     WHERE cp.corridor_id = $1`,
    [corridorId]
  );
  return result.rows[0];
}

module.exports = {
  create,
  countUserCorridors,
  findById,
  listAvailable,
  deleteById,
  findByOwner,
  update,
  getParticipants,
  getCorridorStats
};