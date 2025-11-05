const rateLimit = require("express-rate-limit");

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, message: "Trop de requêtes" },
});

function sanitizeBody(req, res, next) {
  // basic sanitize (placeholder)
  if (req.body) {
    for (const k of Object.keys(req.body)) {
      if (typeof req.body[k] === "string") req.body[k] = req.body[k].trim();
    }
  }
  next();
}

module.exports = {
  apiLimiter,
  sanitizeBody,
};
