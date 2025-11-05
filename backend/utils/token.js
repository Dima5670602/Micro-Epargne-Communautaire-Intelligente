const crypto = require("crypto");

function generateTokenForTontine(id) {
  return crypto.createHash("sha256").update(id + Date.now().toString()).digest("hex").slice(0,16);
}

module.exports = {
  generateTokenForTontine,
};