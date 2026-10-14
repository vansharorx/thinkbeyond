import dotenv from "dotenv";

dotenv.config();

const readNumber = (value: string | undefined, fallback: number, name: string) => {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a finite number`);
  }

  return parsed;
};

const ensureConfiguration = (config: Record<string, string | number | undefined>) => {
  const nodeEnv = config.NODE_ENV;
  const port = Number(config.PORT);
  const aiTimeoutMs = Number(config.AI_TIMEOUT_MS);
  const aiContextMaxChars = Number(config.AI_CONTEXT_MAX_CHARS);
  const aiEvidenceLimit = Number(config.AI_EVIDENCE_LIMIT);
  if (nodeEnv !== "development" && nodeEnv !== "test" && nodeEnv !== "production") {
    throw new Error("NODE_ENV must be development, test, or production");
  }

  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be between 1 and 65535");
  }

  if (!Number.isFinite(aiTimeoutMs) || aiTimeoutMs < 1000 || aiTimeoutMs > 120000) {
    throw new Error("AI_TIMEOUT_MS must be between 1000 and 120000");
  }

  if (!Number.isFinite(aiContextMaxChars) || aiContextMaxChars < 1000 || aiContextMaxChars > 1000000) {
    throw new Error("AI_CONTEXT_MAX_CHARS must be between 1000 and 1000000");
  }

  if (!Number.isFinite(aiEvidenceLimit) || aiEvidenceLimit < 1 || aiEvidenceLimit > 100) {
    throw new Error("AI_EVIDENCE_LIMIT must be between 1 and 100");
  }

  const readinessTimeoutMs = Number(config.READINESS_TIMEOUT_MS);
  if (!Number.isFinite(readinessTimeoutMs) || readinessTimeoutMs < 100 || readinessTimeoutMs > 10000) {
    throw new Error("READINESS_TIMEOUT_MS must be between 100 and 10000");
  }

  const provider = String(config.AI_PROVIDER ?? "").toLowerCase();
  if (!["", "offline", "openai", "gemini", "ollama"].includes(provider)) {
    throw new Error("AI_PROVIDER must be offline, openai, gemini, or ollama");
  }

  const corsOrigins = String(config.CORS_ORIGIN ?? "").split(",").map(origin => origin.trim()).filter(Boolean);
  if (corsOrigins.length === 0 || corsOrigins.includes("*")) {
    throw new Error("CORS_ORIGIN must contain one or more explicit origins");
  }

  const required = [
    "DATABASE_URL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
  ];

  if (nodeEnv !== "production") {
    return;
  }

  const missing = required.filter(key => !String(config[key] ?? "").trim());

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
    if (String(config[key]).length < 32) {
      throw new Error(`${key} must be at least 32 characters in production`);
    }
  }

  if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
    throw new Error("JWT access and refresh secrets must be different in production");
  }

  if (provider === "openai" && !String(config.OPENAI_API_KEY ?? "").trim()) {
    throw new Error("OPENAI_API_KEY is required when AI_PROVIDER is openai");
  }

  if (provider === "gemini" && !String(config.GEMINI_API_KEY ?? "").trim()) {
    throw new Error("GEMINI_API_KEY is required when AI_PROVIDER is gemini");
  }

  if (provider === "ollama" && !String(config.OLLAMA_BASE_URL ?? "").trim()) {
    throw new Error("OLLAMA_BASE_URL is required when AI_PROVIDER is ollama");
  }
};

const env = {
  NODE_ENV: process.env.NODE_ENV || "production",

  PORT: readNumber(process.env.PORT, 5000, "PORT"),

  API_VERSION: process.env.API_VERSION || "v1",

  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",

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
    readNumber(process.env.AI_TIMEOUT_MS, 60000, "AI_TIMEOUT_MS"),

  AI_CONTEXT_MAX_CHARS:
    readNumber(process.env.AI_CONTEXT_MAX_CHARS, 24000, "AI_CONTEXT_MAX_CHARS"),

  AI_EVIDENCE_LIMIT:
    readNumber(process.env.AI_EVIDENCE_LIMIT, 12, "AI_EVIDENCE_LIMIT"),

  READINESS_TIMEOUT_MS:
    readNumber(process.env.READINESS_TIMEOUT_MS, 1500, "READINESS_TIMEOUT_MS"),

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
} as const;

ensureConfiguration(env);

export default env;