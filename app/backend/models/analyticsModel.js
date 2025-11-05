const pool = require("../config/database");

/**
 * Enregistrement d'activité utilisateur - VERSION CORRIGÉE
 */
async function logUserActivity(userId, activityType, details = {}, metadata = {}) {
  try {
    const ipAddress = metadata.ipAddress || null;
    const userAgent = metadata.userAgent || null;
    
    // VERSION SÉCURISÉE - sans la colonne metadata pour l'instant
    await pool.query(`
      INSERT INTO user_activity 
        (user_id, activity_type, description, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      userId, 
      activityType, 
      details.description || `${activityType} activity`,
      JSON.stringify(details),
      ipAddress,
      userAgent
    ]);
    
    return true;
  } catch (err) {
    console.error('Erreur logUserActivity:', err.message);
    return false;
  }
}

/**
 * Récupère les paiements d'un utilisateur avec pagination
 */
async function getUserPayments(userId, limit = 50, offset = 0) {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, t.name as tontine_name, t.currency 
       FROM payments p 
       LEFT JOIN tontines t ON p.tontine_id = t.id 
       WHERE p.user_id = $1 
       ORDER BY p.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM payments WHERE user_id = $1`,
      [userId]
    );

    return {
      payments: rows,
      pagination: {
        total: parseInt(countRows[0].count),
        limit,
        offset,
        hasMore: (offset + rows.length) < parseInt(countRows[0].count)
      }
    };
  } catch (err) {
    console.error('Erreur getUserPayments:', err.message);
    throw new Error('Erreur lors de la récupération des paiements');
  }
}

/**
 * Tendances d'activité avec filtres avancés
 */
async function getActivityTrend(filters = {}) {
  try {
    const { 
      days = 30, 
      activity_type = null, 
      user_id = null 
    } = filters;

    let query = `
      SELECT 
        DATE(created_at) AS day,
        activity_type,
        COUNT(*) AS interactions,
        COUNT(DISTINCT user_id) AS unique_users
      FROM user_activity
      WHERE created_at >= $1
    `;
    
    const params = [new Date(Date.now() - days * 24 * 60 * 60 * 1000)];
    let paramCount = 1;

    if (activity_type) {
      paramCount++;
      query += ` AND activity_type = $${paramCount}`;
      params.push(activity_type);
    }

    if (user_id) {
      paramCount++;
      query += ` AND user_id = $${paramCount}`;
      params.push(user_id);
    }

    query += `
      GROUP BY DATE(created_at), activity_type
      ORDER BY day DESC, interactions DESC
    `;

    const { rows } = await pool.query(query, params);
    return rows;
  } catch (err) {
    console.error('Erreur getActivityTrend:', err.message);
    throw new Error('Erreur lors de la récupération des tendances d\'activité');
  }
}

async function getUserEngagementStats(userId) {
  try {
    const { rows } = await pool.query(`
      SELECT 
        -- Sessions
        COUNT(*) as total_sessions,
        AVG(session_duration) as avg_session_duration,
        MAX(session_duration) as max_session_duration,
        COUNT(DISTINCT DATE(login_time)) as active_days,
        MAX(login_time) as last_login,
        
        -- Activités
        (SELECT COUNT(*) FROM user_activity WHERE user_id = $1) as total_activities,
        (SELECT COUNT(*) FROM user_activity WHERE user_id = $1 AND activity_type = 'payment') as payment_activities,
        (SELECT COUNT(*) FROM user_activity WHERE user_id = $1 AND activity_type = 'message') as message_activities,
        (SELECT COUNT(*) FROM user_activity WHERE user_id = $1 AND activity_type = 'view') as view_activities,
        (SELECT COUNT(*) FROM user_activity WHERE user_id = $1 AND activity_type = 'login') as login_activities,
        
        -- Taux d'engagement récent (7 derniers jours)
        (SELECT COUNT(DISTINCT DATE(created_at)) 
         FROM user_activity 
         WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
        ) as recent_active_days
        
      FROM user_sessions 
      WHERE user_id = $1
    `, [userId]);
    
    return rows[0] || {};
  } catch (err) {
    console.error('Erreur getUserEngagementStats:', err.message);
    throw new Error('Erreur lors du calcul des statistiques d\'engagement');
  }
}

async function getPlatformAnalytics(organisateurId, period = '30 days') {
  try {
    const { rows } = await pool.query(`
      SELECT 
        -- Statistiques des tontines
        (SELECT COUNT(*) FROM tontines WHERE owner_id = $1) as total_tontines,
        (SELECT COUNT(*) FROM tontines WHERE owner_id = $1 AND status = 'active') as active_tontines,
        (SELECT COUNT(*) FROM tontines WHERE owner_id = $1 AND status = 'completed') as completed_tontines,
        
        -- Statistiques de participants
        (SELECT COUNT(*) FROM tontine_participants tp 
         JOIN tontines t ON tp.tontine_id = t.id 
         WHERE t.owner_id = $1) as total_participants,
        (SELECT COUNT(DISTINCT user_id) FROM tontine_participants tp 
         JOIN tontines t ON tp.tontine_id = t.id 
         WHERE t.owner_id = $1) as unique_participants,
        
        -- Statistiques de paiement détaillées
        (SELECT COUNT(*) FROM tontine_participants tp 
         JOIN tontines t ON tp.tontine_id = t.id 
         WHERE t.owner_id = $1 AND tp.payment_status = 'completed') as completed_payments,
        (SELECT COUNT(*) FROM tontine_participants tp 
         JOIN tontines t ON tp.tontine_id = t.id 
         WHERE t.owner_id = $1 AND tp.payment_status = 'pending') as pending_payments,
        (SELECT COUNT(*) FROM tontine_participants tp 
         JOIN tontines t ON tp.tontine_id = t.id 
         WHERE t.owner_id = $1 AND tp.payment_status = 'failed') as failed_payments,
        
        -- Statistiques financières
        (SELECT COALESCE(SUM(amount), 0) FROM payment_history ph 
         JOIN tontines t ON ph.tontine_id = t.id 
         WHERE t.owner_id = $1 AND ph.status = 'completed') as total_collected,
        (SELECT COALESCE(SUM(amount), 0) FROM fund_distributions fd 
         JOIN tontines t ON fd.tontine_id = t.id 
         WHERE t.owner_id = $1) as total_distributed,
        
        -- Statistiques d'engagement
        (SELECT COUNT(*) FROM participation_requests pr 
         JOIN tontines t ON pr.tontine_id = t.id 
         WHERE t.owner_id = $1 AND pr.status = 'pending') as pending_requests,
        (SELECT COUNT(*) FROM notifications 
         WHERE destinataire_id = $1 AND lu = false) as unread_notifications
         
    `, [organisateurId]);
    
    const stats = rows[0] || {};
    
    // Calculs dérivés
    stats.success_rate = stats.total_participants > 0 
      ? Math.round((stats.completed_payments / stats.total_participants) * 100) 
      : 0;
    
    stats.avg_tontine_size = stats.total_tontines > 0 
      ? Math.round(stats.total_participants / stats.total_tontines) 
      : 0;
    
    return stats;
  } catch (err) {
    console.error('Erreur getPlatformAnalytics:', err.message);
    throw new Error('Erreur lors de la récupération des analytics de plateforme');
  }
}

async function updateUserSession(userId, sessionData = {}) {
  try {
    const {
      sessionToken = null,
      duration = 0,
      loginTime = new Date(),
      logoutTime = null,
      ipAddress = null,
      userAgent = null,
      isActive = true
    } = sessionData;

    await pool.query(`
      INSERT INTO user_sessions 
        (user_id, session_token, session_duration, login_time, logout_time, ip_address, user_agent, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (session_token) 
      DO UPDATE SET 
        session_duration = EXCLUDED.session_duration,
        logout_time = EXCLUDED.logout_time,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, sessionToken, duration, loginTime, logoutTime, ipAddress, userAgent, isActive]);
    
    return true;
  } catch (err) {
    console.error('Erreur updateUserSession:', err.message);
    return false;
  }
}

async function getUserRecentActivities(userId, limit = 20) {
  try {
    const { rows } = await pool.query(
      `SELECT activity_type, description, details, created_at 
       FROM user_activity 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    
    return rows;
  } catch (err) {
    console.error('Erreur getUserRecentActivities:', err.message);
    throw new Error('Erreur lors de la récupération des activités récentes');
  }
}

module.exports = {
  getUserPayments,
  getActivityTrend,
  getUserEngagementStats,
  getPlatformAnalytics,
  logUserActivity,
  updateUserSession,
  getUserRecentActivities
};