import prisma from "../config/prisma";
import env from "../config/env";

interface ReadinessResult {
  ready: boolean;
}

type ReadinessQuery = () => Promise<unknown>;

export const createReadinessChecker = (
  query: ReadinessQuery,
  timeoutMs: number
) => {
  let inFlight: Promise<ReadinessResult> | null = null;

  const runQuery = async (): Promise<ReadinessResult> => {
    try {
      await query();
      return { ready: true };
    } catch {
      return { ready: false };
    }
  };

  return async (): Promise<ReadinessResult> => {
    if (!inFlight) {
      // Prisma does not expose a supported cancellation signal for this query.
      // Keep the single underlying operation tracked until it settles, even if
      // individual callers have already received a timeout response.
      inFlight = runQuery().finally(() => {
        inFlight = null;
      });
    }

    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeout = new Promise<ReadinessResult>(resolve => {
      timeoutHandle = setTimeout(() => resolve({ ready: false }), timeoutMs);
    });

    try {
      return await Promise.race([inFlight, timeout]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  };
};

export const checkDatabaseReadiness = createReadinessChecker(
  () => prisma.$queryRaw`SELECT 1`,
  env.READINESS_TIMEOUT_MS
);