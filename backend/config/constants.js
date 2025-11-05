module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || "super_secret_jwt_key",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ||"" ,
  MAX_FREE_CREATIONS: 5,
  MAX_PREMIUM_CREATIONS: 100,
  MAX_FREE_INTEGRATIONS: 5,
  MAX_PREMIUM_INTEGRATIONS: 100,
};
