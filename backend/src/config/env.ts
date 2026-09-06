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

  AI_PROVIDER:
    process.env.AI_PROVIDER || "",

  AI_TIMEOUT_MS:
    Number(process.env.AI_TIMEOUT_MS) || 60000,

  AI_CONTEXT_MAX_CHARS:
    Number(process.env.AI_CONTEXT_MAX_CHARS) || 24000,

  AI_EVIDENCE_LIMIT:
    Number(process.env.AI_EVIDENCE_LIMIT) || 12,

  OPENAI_API_KEY:
    process.env.OPENAI_API_KEY || "",

  OPENAI_BASE_URL:
    process.env.OPENAI_BASE_URL || "",

  OPENAI_MODEL:
    process.env.OPENAI_MODEL || "",

  GEMINI_API_KEY:
    process.env.GEMINI_API_KEY || "",

  GEMINI_MODEL:
    process.env.GEMINI_MODEL || "",

  OLLAMA_BASE_URL:
    process.env.OLLAMA_BASE_URL || "",

  OLLAMA_MODEL:
    process.env.OLLAMA_MODEL || ""
};

export default env;