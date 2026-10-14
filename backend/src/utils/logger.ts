import env from "../config/env";

type LogContext = Record<string, unknown>;
type LogLevel = "info" | "warn" | "error" | "debug";

const write = (level: LogLevel, event: string, context: LogContext = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    severity: level,
    event,
    ...context,
  };

  if (env.NODE_ENV === "production") {
    const output = JSON.stringify(entry);
    if (level === "error") console.error(output);
    else if (level === "warn") console.warn(output);
    else console.log(output);
    return;
  }

  const details = Object.entries(context)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  const message = `[${level.toUpperCase()}] ${event}${details ? ` ${details}` : ""}`;
  if (level === "error") console.error(message);
  else if (level === "warn") console.warn(message);
  else console.log(message);
};

export const logger = {
  info: (event: string, context?: LogContext) => write("info", event, context),
  warn: (event: string, context?: LogContext) => write("warn", event, context),
  error: (event: string, context?: LogContext) => write("error", event, context),
  debug: (event: string, context?: LogContext) => {
    if (env.NODE_ENV === "development") write("debug", event, context);
  },
};