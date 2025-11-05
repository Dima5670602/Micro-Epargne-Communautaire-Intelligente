// backend/middleware/auth.js
const { verifyToken } = require("../auth");
const usersModel = require("../models/usersModel");

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  
  console.log("requireAuth - Header:", authHeader ? "Présent" : "Absent");
  
  if (!authHeader) {
    console.warn("Token manquant");
    return res.status(401).json({ 
      success: false, 
      message: "Token manquant" 
    });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);
  
  if (!payload) {
    console.warn("Token invalide");
    return res.status(401).json({ 
      success: false, 
      message: "Token invalide" 
    });
  }

  console.log("Token valide - User ID:", payload.id);
  
  // Récupérer les infos complètes de l'utilisateur
  try {
    const user = await usersModel.findById(payload.id);
    
    if (!user) {
      console.warn("Utilisateur introuvable");
      return res.status(401).json({ 
        success: false, 
        message: "Utilisateur introuvable" 
      });
    }
    
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      isPremium: user.is_premium || false
    };
    
    console.log("User attaché à req:", req.user);
    next();
    
  } catch (err) {
    console.error("Erreur récupération user:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Erreur serveur" 
    });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    console.log(`requireRole('${role}') - User role:`, req.user?.role);
    
    if (!req.user) {
      console.warn("Non authentifié");
      return res.status(401).json({ 
        success: false, 
        message: "Non authentifié" 
      });
    }
    
    if (req.user.role !== role) {
      console.warn(`Accès refusé - Role requis: ${role}, Role actuel: ${req.user.role}`);
      return res.status(403).json({ 
        success: false, 
        message: "Accès refusé" 
      });
    }
    
    console.log("Rôle validé");
    next();
  };
}

module.exports = { requireAuth, requireRole };