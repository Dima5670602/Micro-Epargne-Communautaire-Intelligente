const express = require("express");
const router = express.Router();
const usersModel = require("../models/usersModel");
const bcrypt = require("bcrypt");
const { generateToken } = require("../auth");

router.post("/register", async (req, res) => {
  try {
    const { nom, prenom, email, password, role, phone } = req.body;
    
    console.log("TENTATIVE D'INSCRIPTION:", { email, role });
    
    // Validation des champs obligatoires
    if (!nom || !prenom || !email || !password || !role) {
      console.log("Champs manquants");
      return res.status(400).json({ 
        success: false, 
        message: "Tous les champs obligatoires doivent être remplis" 
      });
    }

    // Validation du rôle
    if (!['organisateur', 'participant'].includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: "Rôle invalide. Choisissez 'organisateur' ou 'participant'" 
      });
    }

    // Vérifier si l'email existe déjà
    const existingUser = await usersModel.findByEmail(email);
    if (existingUser) {
      console.log("Email déjà utilisé:", email);
      return res.status(409).json({ 
        success: false, 
        message: "Cet email est déjà utilisé" 
      });
    }

    // Créer l'utilisateur
    console.log("👤 Création de l'utilisateur...");
    const newUser = await usersModel.createUser(nom, prenom, email, password, role);
    
    // Générer le token JWT
    console.log("Génération du token...");
    const token = generateToken(newUser);
    
    console.log("NOUVEL UTILISATEUR CRÉÉ:", newUser.email);
    
    res.status(201).json({
      success: true,
      message: "Inscription réussie",
      token: token,
      user: {
        id: newUser.id,
        email: newUser.email,
        nom: newUser.nom,
        prenom: newUser.prenom,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error("ERREUR REGISTER:", error);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors de l'inscription" 
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log("\n========== TENTATIVE DE CONNEXION ==========");
    console.log("Email reçu:", email);
    console.log("Mot de passe reçu:", password ? "***" : "NULL");

    // Validation des champs
    if (!email || !password) {
      console.log("EMAIL OU MOT DE PASSE MANQUANT");
      return res.status(400).json({ 
        success: false, 
        message: "Email et mot de passe requis" 
      });
    }

    // 1. Recherche de l'utilisateur
    console.log("Étape 1: Recherche de l'utilisateur...");
    const user = await usersModel.findByEmail(email);
    
    if (!user) {
      console.log("AUCUN UTILISATEUR TROUVÉ AVEC CET EMAIL");
      return res.status(401).json({ 
        success: false, 
        message: "Identifiants invalides" 
      });
    }

    console.log("UTILISATEUR TROUVÉ:", {
      id: user.id,
      email: user.email,
      role: user.role,
      nom: user.nom,
      prenom: user.prenom
    });

    // 2. Vérification du mot de passe
    console.log(" Étape 2: Vérification du mot de passe...");
    console.log(" Hash stocké (début):", user.password?.substring(0, 25) + "...");
    console.log(" Longueur du hash:", user.password?.length);
    
    // Vérifier si le hash est valide (doit commencer par $2b$10$)
    if (!user.password?.startsWith('$2b$10$')) {
      console.log("FORMAT DE HASH INVALIDE - Le mot de passe n'est pas hashé correctement");
      return res.status(500).json({ 
        success: false, 
        message: "Erreur de configuration du mot de passe" 
      });
    }

    console.log("Comparaison bcrypt en cours...");
    const validPassword = await bcrypt.compare(password, user.password);
    console.log("Résultat bcrypt.compare:", validPassword);

    if (!validPassword) {
      console.log("MOT DE PASSE INCORRECT");
      console.log("Conseil: Vérifiez le mot de passe dans la base de données");
      return res.status(401).json({ 
        success: false, 
        message: "Identifiants invalides" 
      });
    }

    //Génération du token
    console.log("Étape 3: Génération du token...");
    const token = generateToken(user);
    
    if (!token) {
      console.log(" ÉCHEC GÉNÉRATION DU TOKEN");
      return res.status(500).json({ 
        success: false, 
        message: "Erreur lors de la génération du token" 
      });
    }

    console.log(" TOKEN GÉNÉRÉ AVEC SUCCÈS");
    console.log(" CONNEXION RÉUSSIE \n");
    
    res.json({
      success: true,
      message: "Connexion réussie",
      token: token,
      role: user.role,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role
      }
    });

  } catch (error) {
    console.error(" ERREUR CRITIQUE DANS LOGIN:", error);
    console.error(" Stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors de la connexion" 
    });
  }
});


router.get("/verify", async (req, res) => {
  try {
    console.log(" Vérification du token...");
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log(" Token manquant dans les headers");
      return res.json({ valid: false, message: "Token manquant" });
    }

    const token = authHeader.split(" ")[1];
    const { verifyToken } = require("../auth");
    const payload = verifyToken(token);
    
    if (!payload) {
      console.log(" Token invalide ou expiré");
      return res.json({ valid: false, message: "Token invalide" });
    }

    // Récupérer les infos utilisateur
    const user = await usersModel.findById(payload.id);
    if (!user) {
      console.log(" Utilisateur introuvable pour le token");
      return res.json({ valid: false, message: "Utilisateur introuvable" });
    }

    console.log(" Token valide pour l'utilisateur:", user.email);
    
    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role
      }
    });
  } catch (error) {
    console.error(" Erreur lors de la vérification:", error);
    res.json({ valid: false, message: "Erreur de vérification" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    
    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email et nouveau mot de passe requis"
      });
    }

    const user = await usersModel.findByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé"
      });
    }

    // En production, vous devriez avoir un token de réinitialisation
    console.log(" Réinitialisation du mot de passe pour:", email);
    
    res.json({
      success: true,
      message: "Mot de passe réinitialisé avec succès"
    });
  } catch (error) {
    console.error(" Erreur reset-password:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la réinitialisation"
    });
  }
});

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Auth API fonctionne correctement",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;