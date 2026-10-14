import http from "node:http";
import app from "./app";
import env from "./config/env";
import { logger } from "./utils/logger";
import prisma from "./config/prisma";
import { checkDatabaseReadiness } from "./services/health.service";
import { createShutdownHandler } from "./services/shutdown.service";

export const startServer = async () => {
  const readiness = await checkDatabaseReadiness();
  if (!readiness.ready) {
    await prisma.$disconnect().catch(() => undefined);
    logger.error("server.startup_failed", { reason: "database_not_ready" });
    process.exitCode = 1;
    return null;
  }

  const server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(env.PORT, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  logger.info("server.started", { port: env.PORT });

  const shutdown = createShutdownHandler(server, () => prisma.$disconnect());
  const handleSignal = (signal: string) => {
    logger.info("server.shutdown_requested", { signal });
    void shutdown().then(result => {
      logger.info("server.stopped", { timedOut: result.timedOut });
      process.exitCode = result.timedOut || result.disconnectFailed ? 1 : 0;
    }).catch(error => {
      logger.error("server.shutdown_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
      process.exitCode = 1;
    });
  };

  process.once("SIGINT", () => handleSignal("SIGINT"));
  process.once("SIGTERM", () => handleSignal("SIGTERM"));

  return server;
};

void startServer().catch(error => {
  void prisma.$disconnect().catch(() => undefined);
  logger.error("server.startup_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
  process.exitCode = 1;
});