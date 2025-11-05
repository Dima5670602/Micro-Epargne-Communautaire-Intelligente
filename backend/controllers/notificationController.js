const pool = require("../config/database");

async function getUserNotifications(req, res) {
  const userId = req.user.id;
  try {
    console.log(`Récupération des notifications pour l'utilisateur ${userId}`);
    
    const { rows } = await pool.query(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC", 
      [userId]
    );
    
    console.log(`${rows.length} notification(s) trouvée(s) pour l'utilisateur ${userId}`);
    
    res.json({ 
      success: true, 
      data: rows 
    });
  } catch (err) {
    console.error('Erreur getUserNotifications:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la récupération des notifications',
      error: err.message 
    });
  }
}

async function createNotification(userId, title, body, meta = {}) {
  try {
    console.log(`Création notification pour l'utilisateur ${userId}: ${title}`);
    
    await pool.query(
      "INSERT INTO notifications(user_id, title, body, meta) VALUES($1, $2, $3, $4)",
      [userId, title, body, JSON.stringify(meta)]
    );
    
    console.log(`Notification créée avec succès pour l'utilisateur ${userId}`);
  } catch (err) {
    console.error("Erreur createNotification:", err);
  }
}

async function clearAllNotifications(req, res) {
  const userId = req.user.id;
  try {
    console.log(`Suppression de toutes les notifications pour l'utilisateur ${userId}`);
    
    const result = await pool.query(
      "DELETE FROM notifications WHERE user_id = $1 RETURNING *",
      [userId]
    );
    
    console.log(`${result.rowCount} notification(s) supprimée(s) pour l'utilisateur ${userId}`);
    
    res.json({ 
      success: true, 
      message: `Toutes les notifications ont été supprimées (${result.rowCount} notification(s) supprimée(s))`,
      deletedCount: result.rowCount
    });
  } catch (err) {
    console.error('Erreur clearAllNotifications:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la suppression des notifications',
      error: err.message 
    });
  }
}

async function deleteNotification(req, res) {
  const userId = req.user.id;
  const { notificationId } = req.params;
  
  try {
    console.log(`Suppression de la notification ${notificationId} pour l'utilisateur ${userId}`);
    
    // Vérifier que la notification appartient à l'utilisateur
    const notificationCheck = await pool.query(
      "SELECT * FROM notifications WHERE id = $1 AND user_id = $2",
      [notificationId, userId]
    );
    
    if (notificationCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification non trouvée"
      });
    }
    
    const result = await pool.query(
      "DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *",
      [notificationId, userId]
    );
    
    console.log(`Notification ${notificationId} supprimée avec succès`);
    
    res.json({ 
      success: true, 
      message: "Notification supprimée avec succès",
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Erreur deleteNotification:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la suppression de la notification',
      error: err.message 
    });
  }
}

module.exports = {
  getUserNotifications,
  createNotification,
  clearAllNotifications,
  deleteNotification
};