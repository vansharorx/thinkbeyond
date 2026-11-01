import prisma from "../config/prisma";
import type { RepositoryStatus } from "@prisma/client";

export const repositoryLifecycleSelect = {
  id: true,
  ownerId: true,
  sourceUrl: true,
  sourceKey: true,
  status: true,
  phase: true,
  attemptCount: true,
  lastAttemptAt: true,
  lastErrorCode: true,
  lastErrorMessage: true,
  startedAt: true,
  completedAt: true,
  leaseOwner: true,
  leaseExpiresAt: true,
  activeAttemptId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type RepositoryLifecycle = {
  id: string;
  ownerId: string;
  sourceUrl: string | null;
  sourceKey: string | null;
  status: RepositoryStatus;
  phase: string;
  attemptCount: number;
  lastAttemptAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  activeAttemptId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const createRepository = async (id: string, ownerId: string) => {
  return prisma.repository.create({
    data: {
      id,
      ownerId,
    },
  });
};

export const findRepositoryByOwnerAndSource = async (ownerId: string, sourceKey: string) =>
  prisma.repository.findFirst({
    where: { ownerId, sourceKey },
    select: repositoryLifecycleSelect,
  });

export const createPendingRepository = async (input: {
  id: string;
  ownerId: string;
  sourceUrl: string;
  sourceKey: string;
}) => prisma.repository.create({
  data: {
    id: input.id,
    ownerId: input.ownerId,
    sourceUrl: input.sourceUrl,
    sourceKey: input.sourceKey,
    status: "pending",
    phase: "queued",
  },
  select: repositoryLifecycleSelect,
});

export const findRepositoryLifecycleById = async (id: string) =>
  prisma.repository.findUnique({ where: { id }, select: repositoryLifecycleSelect });

export const updateRepositoryLifecycle = async (
  id: string,
  data: {
    status?: RepositoryStatus;
    phase?: string;
    attemptCount?: number;
    lastAttemptAt?: Date | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
    leaseOwner?: string | null;
    leaseExpiresAt?: Date | null;
    activeAttemptId?: string | null;
  }
) => prisma.repository.update({
  where: { id },
  data,
  select: repositoryLifecycleSelect,
});

export const claimPendingRepository = async (
  id: string,
  leaseOwner: string,
  attemptCount: number,
  startedAt: Date,
  leaseExpiresAt: Date
) => prisma.repository.updateMany({
  where: { id, status: "pending" },
  data: {
    status: "cloning",
    phase: "cloning",
    attemptCount,
    lastAttemptAt: startedAt,
    startedAt,
    leaseOwner,
    leaseExpiresAt,
    lastErrorCode: null,
    lastErrorMessage: null,
  },
});

export const updateOwnedRepositoryLifecycle = async (
  id: string,
  leaseOwner: string,
  data: Parameters<typeof updateRepositoryLifecycle>[1]
) => prisma.repository.updateMany({
  where: {
    id,
    leaseOwner,
    status: { in: ["cloning", "analyzing"] },
  },
  data,
});

export const renewRepositoryLease = async (
  id: string,
  leaseOwner: string,
  leaseExpiresAt: Date
) => prisma.repository.updateMany({
  where: { id, leaseOwner, status: { in: ["cloning", "analyzing"] } },
  data: { leaseExpiresAt },
});

export const expireRepositoryLease = async (id: string, leaseOwner: string) => prisma.repository.updateMany({
  where: { id, leaseOwner, status: { in: ["cloning", "analyzing"] } },
  data: { leaseExpiresAt: new Date() },
});

export const findPendingRepositories = async () => prisma.repository.findMany({
  where: { status: "pending" },
  select: repositoryLifecycleSelect,
});

export const findStaleActiveRepositories = async (now: Date) => prisma.repository.findMany({
  where: {
    status: { in: ["cloning", "analyzing"] },
    OR: [
      { leaseExpiresAt: null },
      { leaseExpiresAt: { lt: now } },
    ],
  },
  select: repositoryLifecycleSelect,
});

export const recoverStaleRepository = async (id: string, now: Date) => prisma.repository.updateMany({
  where: {
    id,
    status: { in: ["cloning", "analyzing"] },
    OR: [
      { leaseExpiresAt: null },
      { leaseExpiresAt: { lt: now } },
    ],
  },
  data: {
    status: "failed",
    phase: "recovery",
    lastErrorCode: "PROCESS_INTERRUPTED",
    lastErrorMessage: "Analysis was interrupted by a previous process and must be retried.",
    completedAt: null,
    leaseOwner: null,
    leaseExpiresAt: null,
  },
});

export const findRepositoryOwnedByUser = async (
  id: string,
  ownerId: string
) => {
  return prisma.repository.findFirst({
    where: {
      id,
      ownerId,
    },
    select: repositoryLifecycleSelect,
  });
};