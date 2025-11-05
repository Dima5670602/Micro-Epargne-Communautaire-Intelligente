const analyticsModel = require("../models/analyticsModel");

function trackUserActivity(req, res, next) {
  const startTime = Date.now();
  
  // Intercepter la fin de la réponse
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    if (req.user && req.user.id) {
      // Enregistrer l'activité
      analyticsModel.logUserActivity(req.user.id, 'api_request', {
        method: req.method,
        path: req.path,
        duration: duration,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent')
      }).catch(err => {
        console.error('Erreur tracking activité:', err);
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
}

function trackSessionTime(req, res, next) {
  if (req.user && req.user.id) {
    // Enregistrer le temps de connexion
    const loginTime = new Date();
    
    // Intercepter la déconnexion
    req.on('end', () => {
      const logoutTime = new Date();
      const duration = logoutTime - loginTime;
      
      analyticsModel.updateUserSession(req.user.id, {
        duration: duration,
        loginTime: loginTime,
        logoutTime: logoutTime
      }).catch(err => {
        console.error('Erreur tracking session:', err);
      });
    });
  }
  
  next();
}

module.exports = {
  trackUserActivity,
  trackSessionTime
};