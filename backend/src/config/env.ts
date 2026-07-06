import dotenv from "dotenv";

dotenv.config();

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",

  PORT: Number(process.env.PORT) || 5000,

  API_VERSION: process.env.API_VERSION || "v1",

  JWT_SECRET:
    process.env.JWT_SECRET || "replace_with_a_secure_secret",

  JWT_EXPIRES_IN:
    process.env.JWT_EXPIRES_IN || "1d",

  DATABASE_URL:
    process.env.DATABASE_URL || "",

  REDIS_URL:
    process.env.REDIS_URL || "",

  GEMINI_API_KEY:
    process.env.GEMINI_API_KEY || ""
};

export default env;