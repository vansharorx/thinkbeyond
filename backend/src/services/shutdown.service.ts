import type { Server } from "node:http";

export const createShutdownHandler = (
  server: Server,
  disconnect: () => Promise<void>,
  timeoutMs = 10_000
) => {
  let inFlight: Promise<{ timedOut: boolean; disconnectFailed: boolean }> | null = null;

  return () => {
    if (!inFlight) {
      inFlight = shutdownServer(server, disconnect, timeoutMs);
    }
    return inFlight;
  };
};

export const shutdownServer = async (
  server: Server,
  disconnect: () => Promise<void>,
  timeoutMs = 10_000
): Promise<{ timedOut: boolean; disconnectFailed: boolean }> => {
  let timedOut = false;
  let disconnectFailed = false;
  const shutdownStartedAt = Date.now();

  const closePromise = new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") {
        reject(error);
        return;
      }
      resolve();
    });
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("shutdown timeout")), timeoutMs).unref();
  });

  try {
    await Promise.race([closePromise, timeoutPromise]);
  } catch {
    timedOut = true;
    server.closeAllConnections?.();
  } finally {
    try {
      const remainingMs = Math.max(0, timeoutMs - (Date.now() - shutdownStartedAt));
      await Promise.race([
        disconnect(),
        new Promise<never>((_, reject) => {
          const timeout = setTimeout(() => reject(new Error("shutdown cleanup timeout")), remainingMs);
          timeout.unref();
        }),
      ]);
    } catch (error) {
      if (error instanceof Error && error.message === "shutdown cleanup timeout") {
        timedOut = true;
      }
      disconnectFailed = true;
    }
  }

  return { timedOut, disconnectFailed };
};