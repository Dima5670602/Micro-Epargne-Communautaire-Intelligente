const express = require("express");
const router = express.Router();
const tontineController = require("../controllers/tontineController");
const { requireAuth, requireRole } = require("../middleware/auth");

// Route de test
router.get("/test", (req, res) => {
  console.log("Route /api/tontines/test appelée");
  res.json({ 
    success: true,
    message: "API Tontines fonctionne!",
    timestamp: new Date().toISOString()
  });
});

// Récupérer toutes les tontines de l'utilisateur
router.get("/", requireAuth, tontineController.getUserTontines);

// Route création tontine (authentification + rôle organisateur requis)
router.post("/create", requireAuth, requireRole("organisateur"), tontineController.createTontine);

// Route détails tontine (authentification requise)
router.get("/:id", requireAuth, tontineController.getTontineDetails);

// Suppression tontine
router.delete("/:id", requireAuth, tontineController.deleteTontine);

// Route rejoindre par token (authentification requise)
router.post("/join", requireAuth, tontineController.joinByToken);

// Demander à rejoindre une tontine
router.post("/request-join", requireAuth, tontineController.requestJoinTontine);

module.exports = router;