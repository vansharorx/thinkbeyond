import fs from "fs/promises";
import { randomUUID } from "node:crypto";
import type { RepositoryStatus } from "@prisma/client";
import { AppError } from "../utils/AppError";
import env from "../config/env";
import { logger } from "../utils/logger";
import {
  claimPendingRepository,
  createPendingRepository,
  expireRepositoryLease,
  findPendingRepositories,
  findRepositoryByOwnerAndSource,
  findRepositoryLifecycleById,
  findStaleActiveRepositories,
  recoverStaleRepository,
  renewRepositoryLease,
  updateOwnedRepositoryLifecycle,
  updateRepositoryLifecycle,
  type RepositoryLifecycle,
} from "../repositories/repository.repository";
import { canonicalizeRepositoryUrl } from "./repository-url.service";
import { ensureRepositoryAttemptPath } from "./repository-explorer-state.service";
import { runRepositoryAnalysis } from "./repository-analysis.service";

export type LifecycleResponse = Pick<RepositoryLifecycle,
  "id" | "status" | "phase" | "attemptCount" | "lastAttemptAt" | "lastErrorCode" | "lastErrorMessage" | "startedAt" | "completedAt" | "createdAt" | "updatedAt"
>;

const MAX_CONCURRENT_ANALYSES = 2;
const workerId = randomUUID();
const queue: string[] = [];
const queued = new Set<string>();
const running = new Set<string>();
const activeCancellations = new Map<string, () => void>();
let acceptingJobs = true;

class LostLeaseError extends Error {}

const publicLifecycle = (repository: RepositoryLifecycle): LifecycleResponse => ({
  id: repository.id,
  status: repository.status,
  phase: repository.phase,
  attemptCount: repository.attemptCount,
  lastAttemptAt: repository.lastAttemptAt,
  lastErrorCode: repository.lastErrorCode,
  lastErrorMessage: repository.lastErrorMessage,
  startedAt: repository.startedAt,
  completedAt: repository.completedAt,
  createdAt: repository.createdAt,
  updatedAt: repository.updatedAt,
});

export const queueRepositoryImport = async (
  url: unknown,
  ownerId: string,
  options: { enqueue?: boolean } = {}
) => {
  const source = canonicalizeRepositoryUrl(url);
  let repository = await findRepositoryByOwnerAndSource(ownerId, source.sourceKey);
  let created = false;

  if (!repository) {
    try {
      repository = await createPendingRepository({
        id: randomUUID(),
        ownerId,
        sourceUrl: source.canonicalUrl,
        sourceKey: source.sourceKey,
      });
      created = true;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      repository = await findRepositoryByOwnerAndSource(ownerId, source.sourceKey);
      if (!repository) throw error;
    }
  }

  if (options.enqueue !== false && (created || repository.status === "pending")) {
    if (!enqueue(repository.id)) {
      if (created) {
        await updateRepositoryLifecycle(repository.id, {
          status: "failed",
          phase: "queue",
          lastErrorCode: "QUEUE_FULL",
          lastErrorMessage: "The repository analysis queue is full. Retry the import later.",
        });
      }
      throw new AppError("Repository analysis queue is full", 503);
    }
  }

  return { repository: publicLifecycle(repository), created };
};

export const getRepositoryLifecycle = async (repositoryId: string) => {
  const repository = await findRepositoryLifecycleById(repositoryId);
  return repository ? publicLifecycle(repository) : null;
};

export const retryRepositoryImport = async (
  repositoryId: string,
  ownerId: string,
  options: { enqueue?: boolean } = {}
) => {
  const repository = await findRepositoryLifecycleById(repositoryId);
  if (!repository || repository.ownerId !== ownerId) return null;
  if (!repository.sourceUrl || !repository.sourceKey) return publicLifecycle(repository);
  if (repository.status === "ready" || repository.status === "pending" || repository.status === "cloning" || repository.status === "analyzing") {
    if (options.enqueue !== false && repository.status === "pending" && !enqueue(repository.id)) {
      throw new AppError("Repository analysis queue is full", 503);
    }
    return publicLifecycle(repository);
  }

  const updated = await updateRepositoryLifecycle(repository.id, {
    status: "pending",
    phase: "queued",
    lastErrorCode: null,
    lastErrorMessage: null,
    completedAt: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    activeAttemptId: null,
  });
  if (options.enqueue !== false && !enqueue(updated.id)) {
    await updateRepositoryLifecycle(updated.id, {
      status: "failed",
      phase: "queue",
      lastErrorCode: "QUEUE_FULL",
      lastErrorMessage: "The repository analysis queue is full. Retry the import later.",
    });
    throw new AppError("Repository analysis queue is full", 503);
  }
  return publicLifecycle(updated);
};

export const recoverInterruptedRepositories = async () => {
  const now = new Date();
  const stale = await findStaleActiveRepositories(now);
  await Promise.all(stale.map(async repository => {
    await recoverStaleRepository(repository.id, now);
  }));

  const pending = await findPendingRepositories();
  for (const repository of pending) enqueue(repository.id);
};

export const stopAcceptingRepositoryJobs = () => {
  acceptingJobs = false;
};

export const enqueueRepositoryForAnalysis = (repositoryId: string): boolean =>
  enqueue(repositoryId);

export const drainRepositoryWorkers = async (timeoutMs: number): Promise<{ timedOut: boolean }> => {
  stopAcceptingRepositoryJobs();
  queue.length = 0;
  queued.clear();
  const deadline = Date.now() + timeoutMs;
  while (queue.length > 0 || running.size > 0) {
    if (Date.now() >= deadline) {
      for (const cancel of activeCancellations.values()) cancel();
      await expireWorkerLeases();
      return { timedOut: true };
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return { timedOut: false };
};

const expireWorkerLeases = async () => {
  for (const repositoryId of running) {
    await expireRepositoryLease(repositoryId, workerId).catch(error => {
      logger.error("repository.lifecycle_lease_expiry_failed", { repositoryId, errorName: error instanceof Error ? error.name : "UnknownError" });
    });
  }
};

const enqueue = (repositoryId: string): boolean => {
  if (!acceptingJobs) return false;
  if (queued.has(repositoryId) || running.has(repositoryId)) return true;
  if (queue.length >= env.REPOSITORY_QUEUE_MAX) return false;
  queued.add(repositoryId);
  queue.push(repositoryId);
  void pump();
  return true;
};

const pump = async () => {
  while (acceptingJobs && running.size < MAX_CONCURRENT_ANALYSES && queue.length > 0) {
    const repositoryId = queue.shift();
    if (!repositoryId) continue;
    queued.delete(repositoryId);
    running.add(repositoryId);
    void processRepository(repositoryId)
      .catch(error => {
        logger.error("repository.lifecycle_worker_failed", { repositoryId, errorName: error instanceof Error ? error.name : "UnknownError" });
      })
      .finally(() => {
        running.delete(repositoryId);
        void pump().catch(error => {
          logger.error("repository.lifecycle_pump_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
        });
      });
  }
};

const processRepository = async (repositoryId: string) => {
  let attemptPath: string | undefined;
  let cancelExecution = () => undefined;
  try {
    const repository = await findRepositoryLifecycleById(repositoryId);
    if (!repository || !repository.sourceUrl || repository.status !== "pending") return;

    const startedAt = new Date();
    const attemptId = `${workerId}-${randomUUID()}`;
    const leaseExpiresAt = new Date(startedAt.getTime() + env.REPOSITORY_LEASE_TIMEOUT_MS);
    const claim = await claimPendingRepository(repositoryId, workerId, repository.attemptCount + 1, startedAt, leaseExpiresAt);
    if (claim.count !== 1) return;

    let leaseLost = false;
    let cancelled = false;
    cancelExecution = () => { cancelled = true; };
    activeCancellations.set(repositoryId, cancelExecution);
    const assertActive = () => {
      if (leaseLost || cancelled) throw new LostLeaseError("Repository worker execution was cancelled");
    };
    attemptPath = await ensureRepositoryAttemptPath(repositoryId, attemptId);
    if (!attemptPath) throw new LostLeaseError("Repository attempt path was not created");
    const heartbeat = setInterval(() => {
      void renewRepositoryLease(repositoryId, workerId, new Date(Date.now() + env.REPOSITORY_LEASE_TIMEOUT_MS))
        .then(result => {
          if (result.count !== 1) {
            leaseLost = true;
            cancelled = true;
            logger.warn("repository.lifecycle_execution_cancelled", { repositoryId, reason: "lease_lost" });
          }
        })
        .catch(error => {
          leaseLost = true;
          cancelled = true;
          logger.error("repository.lifecycle_heartbeat_failed", { repositoryId, errorName: error instanceof Error ? error.name : "UnknownError" });
        });
    }, Math.max(1000, Math.floor(env.REPOSITORY_LEASE_TIMEOUT_MS / 3)));
    heartbeat.unref();

    const transition = async (data: Parameters<typeof updateRepositoryLifecycle>[1]) => {
      assertActive();
      const result = await updateOwnedRepositoryLifecycle(repositoryId, workerId, data);
      if (result.count !== 1) throw new LostLeaseError("Repository worker lease was lost");
    };

    try {
      await transition({ status: "analyzing", phase: "scanning" });
      await runRepositoryAnalysis(repositoryId, repository.ownerId, repository.sourceUrl, async phase => {
        await transition({ status: "analyzing", phase });
      }, { attemptPath, attemptId, assertActive });
      await transition({ status: "ready", phase: "completed", completedAt: new Date(), lastErrorCode: null, lastErrorMessage: null, leaseOwner: null, leaseExpiresAt: null, activeAttemptId: attemptId });
    } catch (error) {
      if (!(error instanceof LostLeaseError)) {
        if (attemptPath) await fs.rm(attemptPath, { recursive: true, force: true }).catch(cleanupError => {
          logger.error("repository.lifecycle_cleanup_failed", { repositoryId, errorName: cleanupError instanceof Error ? cleanupError.name : "UnknownError" });
        });
        try {
          await transition({ status: "failed", phase: "failed", lastErrorCode: "ANALYSIS_FAILED", lastErrorMessage: "Repository analysis failed. Retry the import to try again.", completedAt: null, leaseOwner: null, leaseExpiresAt: null, activeAttemptId: null });
        } catch (stateError) {
          logger.error("repository.lifecycle_persistence_failed", { repositoryId, errorName: stateError instanceof Error ? stateError.name : "UnknownError" });
        }
      } else {
        logger.warn("repository.lifecycle_lease_lost", { repositoryId });
      }
    } finally {
      clearInterval(heartbeat);
      activeCancellations.delete(repositoryId);
    }
  } catch (error) {
    if (attemptPath) await fs.rm(attemptPath, { recursive: true, force: true }).catch(cleanupError => {
      logger.error("repository.lifecycle_cleanup_failed", { repositoryId, errorName: cleanupError instanceof Error ? cleanupError.name : "UnknownError" });
    });
    logger.error("repository.lifecycle_worker_failed", { repositoryId, errorName: error instanceof Error ? error.name : "UnknownError" });
    activeCancellations.delete(repositoryId);
  }
};

const isUniqueConstraintError = (error: unknown): boolean =>
  Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");