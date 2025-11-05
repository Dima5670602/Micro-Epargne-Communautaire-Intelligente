const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de base
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Chargement sécurisé des routes
function loadRoute(routePath, routeName) {
  try {
    const routeModule = require(routePath);
    const router = typeof routeModule === "function" ? routeModule : routeModule.router;
    app.use(`/api/${routeName}`, router);
  } catch {
    // Si une route n'existe pas, on passe
  }
}

// Chargement des routes
loadRoute("./routes/authRoutes", "auth");
loadRoute("./routes/corridorRoutes", "corridors");
loadRoute("./routes/tontineRoutes", "tontines");
loadRoute("./routes/participantRoutes", "participants");
loadRoute("./routes/analyticsRoutes", "analytics");
loadRoute("./routes/notificationRoutes", "notifications");
loadRoute("./routes/organizerRoutes", "organizer");
loadRoute("./routes/profileRoutes", "profile");
loadRoute("./routes/historyRoutes", "history");
loadRoute("./routes/messageRoutes", "messages");
loadRoute("./routes/paymentRoutes", "payments");

// Middlewares optionnels
try {
  const { apiLimiter, sanitizeBody } = require("./middleware/security");
  app.use(apiLimiter);
  app.use(sanitizeBody);
} catch {}

try {
  const { trackUserActivity, trackSessionTime } = require("./middleware/activityTracker");
  app.use(trackUserActivity);
  app.use(trackSessionTime);
} catch {}

// Routes principales
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.get("/dashboard", (req, res) => {
  res.redirect("/login.html");
});

app.get("/post-login", (req, res) => {
  res.redirect("/login.html");
});

// Vérification de l'état du serveur
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    message: "Serveur fonctionnel"
  });
});

// Gestion des erreurs 404 pour l’API
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route API non trouvée",
    path: req.path
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur en ligne sur http://localhost:${PORT}`);
});
