const pool = require("../config/database");

async function getPaymentHistory(tontineId) {
  try {
    const { rows } = await pool.query(
      `SELECT 
        ph.*,
        u.prenom,
        u.nom,
        u.email,
        t.name as tontine_name
       FROM payment_history ph
       INNER JOIN users u ON ph.user_id = u.id
       INNER JOIN tontines t ON ph.tontine_id = t.id
       WHERE ph.tontine_id = $1
       ORDER BY ph.payment_date DESC`,
      [tontineId]
    );
    return rows;
  } catch (err) {
    console.error('Erreur getPaymentHistory:', err);
    throw err;
  }
}

async function getOrganizerPaymentStats(organizerId) {
  try {
    const { rows } = await pool.query(
      `SELECT 
        t.id as tontine_id,
        t.name as tontine_name,
        COUNT(tp.user_id) as total_participants,
        COUNT(CASE WHEN tp.payment_status = 'completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN tp.payment_status = 'pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN tp.funds_received = true THEN 1 END) as funds_distributed,
        COALESCE(SUM(CASE WHEN ph.status = 'completed' THEN ph.amount END), 0) as total_collected,
        COALESCE(SUM(CASE WHEN fd.amount THEN fd.amount END), 0) as total_distributed,
        (COALESCE(SUM(CASE WHEN ph.status = 'completed' THEN ph.amount END), 0) - COALESCE(SUM(CASE WHEN fd.amount THEN fd.amount END), 0)) as current_balance
       FROM tontines t
       LEFT JOIN tontine_participants tp ON t.id = tp.tontine_id
       LEFT JOIN payment_history ph ON t.id = ph.tontine_id
       LEFT JOIN fund_distributions fd ON t.id = fd.tontine_id
       WHERE t.owner_id = $1
       GROUP BY t.id, t.name
       ORDER BY t.created_at DESC`,
      [organizerId]
    );
    return rows;
  } catch (err) {
    console.error('Erreur getOrganizerPaymentStats:', err);
    throw err;
  }
}

async function hasUserPaid(tontineId, userId) {
  try {
    const { rows } = await pool.query(
      `SELECT payment_status 
       FROM tontine_participants 
       WHERE tontine_id = $1 AND user_id = $2`,
      [tontineId, userId]
    );
    
    return rows.length > 0 && rows[0].payment_status === 'completed';
  } catch (err) {
    console.error('Erreur hasUserPaid:', err);
    throw err;
  }
}

async function getOrganizerTotalBalance(organizerId) {
  try {
    const { rows } = await pool.query(
      `SELECT 
        COALESCE(SUM(
          (SELECT COALESCE(SUM(amount), 0) FROM payment_history ph WHERE ph.tontine_id = t.id AND status = 'completed')
          - 
          (SELECT COALESCE(SUM(amount), 0) FROM fund_distributions fd WHERE fd.tontine_id = t.id)
        ), 0) as total_balance
       FROM tontines t
       WHERE t.owner_id = $1`,
      [organizerId]
    );
    return rows[0].total_balance;
  } catch (err) {
    console.error('Erreur getOrganizerTotalBalance:', err);
    throw err;
  }
}

async function getOrganizerRecentTransactions(organizerId, limit = 10) {
  try {
    const { rows } = await pool.query(
      `(
        SELECT 
          'payment' as type,
          ph.amount,
          ph.payment_date as date,
          u.prenom,
          u.nom,
          t.name as tontine_name,
          NULL as distributed_to
        FROM payment_history ph
        INNER JOIN tontines t ON ph.tontine_id = t.id
        INNER JOIN users u ON ph.user_id = u.id
        WHERE t.owner_id = $1 AND ph.status = 'completed'
      )
      UNION ALL
      (
        SELECT 
          'distribution' as type,
          fd.amount,
          fd.distribution_date as date,
          u1.prenom as prenom,
          u1.nom as nom,
          t.name as tontine_name,
          u2.prenom || ' ' || u2.nom as distributed_to
        FROM fund_distributions fd
        INNER JOIN tontines t ON fd.tontine_id = t.id
        INNER JOIN users u1 ON fd.distributed_by = u1.id
        INNER JOIN users u2 ON fd.user_id = u2.id
        WHERE t.owner_id = $1
      )
      ORDER BY date DESC
      LIMIT $2`,
      [organizerId, limit]
    );
    return rows;
  } catch (err) {
    console.error('Erreur getOrganizerRecentTransactions:', err);
    throw err;
  }
}

module.exports = {
  getPaymentHistory,
  getOrganizerPaymentStats,
  hasUserPaid,
  getOrganizerTotalBalance,
  getOrganizerRecentTransactions
};