import dotenv from "dotenv";

dotenv.config();

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",

  PORT: Number(process.env.PORT) || 5000,

  API_VERSION: process.env.API_VERSION || "v1",

  JWT_ACCESS_SECRET:
  process.env.JWT_ACCESS_SECRET || "",

  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET || "",

  JWT_ACCESS_EXPIRES_IN:
    process.env.JWT_ACCESS_EXPIRES_IN || "15m",

  JWT_REFRESH_EXPIRES_IN:
    process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  DATABASE_URL:
    process.env.DATABASE_URL || "",

  REDIS_URL:
    process.env.REDIS_URL || "",

  GEMINI_API_KEY:
    process.env.GEMINI_API_KEY || ""
};

export default env;