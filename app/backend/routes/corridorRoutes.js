const express = require("express");
const router = express.Router();
const corridorController = require("../controllers/corridorController");
const { requireAuth, requireRole } = require("../middleware/auth");



// Route de test
router.get("/test", (req, res) => {
  console.log("Route /api/corridors/test appelée");
  res.json({ 
    success: true,
    message: "API Corridors fonctionne!",
    timestamp: new Date().toISOString()
  });
});

// Récupérer tous les corridors de l'utilisateur
router.get("/", requireAuth, corridorController.getUserCorridors);

// Route création corridor (authentification + rôle organisateur requis)
router.post("/create", requireAuth, requireRole("organisateur"), corridorController.createCorridor);

// Route détails corridor (authentification requise)
router.get("/:id", requireAuth, corridorController.getCorridorDetails);

// Route suppression corridor (authentification requise)
router.delete("/:id", requireAuth, corridorController.deleteCorridor);

module.exports = router;