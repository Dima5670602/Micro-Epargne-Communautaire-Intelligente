const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./config/constants");

function generateToken(user) {
  const payload = {
    id: user.id,
    role: user.role,
    email: user.email,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken,
};
