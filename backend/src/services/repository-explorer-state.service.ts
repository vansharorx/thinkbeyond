import fs from "fs/promises";
import path from "path";
import { randomUUID } from "node:crypto";
import prisma from "../config/prisma";
import { logger } from "../utils/logger";

import type { WorkspaceAnalysis } from "./workspace.service";
import type { SourceFile } from "./source-indexer.service";
import type { RepositorySummary } from "./repository-summary.service";
import type { RepositoryKnowledge } from "./repository-knowledge.service";
import type { GlobalSymbolInfo } from "../analysis/symbols/global-symbol-table.service";
import type { SymbolInfo } from "../analysis/symbols/symbol-table.service";

type SerializableMapEntry<T> = [string, T];

export interface SerializedSourceFile extends Omit<SourceFile, "symbolTable"> {
  symbolTable: SerializableMapEntry<SymbolInfo>[];
}

export interface SerializedWorkspaceAnalysis
  extends Omit<WorkspaceAnalysis, "globalSymbolTable" | "sourceFiles"> {
  globalSymbolTable: SerializableMapEntry<GlobalSymbolInfo>[];
  sourceFiles: SerializedSourceFile[];
}

export interface RepositoryKnowledgeSnapshot
  extends Omit<RepositoryKnowledge, "analyzeImpact"> {}

export interface RepositoryExplorerState {
  repositoryId: string;
  repositoryPath: string;
  summary: RepositorySummary;
  knowledge: RepositoryKnowledgeSnapshot;
  workspaces: WorkspaceAnalysis[];
}

interface SerializedRepositoryExplorerState {
  repositoryId: string;
  repositoryPath: string;
  summary: RepositorySummary;
  knowledge: RepositoryKnowledgeSnapshot;
  workspaces: SerializedWorkspaceAnalysis[];
}

export const getRepositoryRootPath = (repositoryId: string): string =>
  resolveRepositoryStoragePath(repositoryId);

export const validateRepositoryId = (repositoryId: string): string => {
  if (!repositoryId || typeof repositoryId !== "string") {
    throw new Error("Repository ID is required");
  }

  if (!/^[A-Za-z0-9-]+$/.test(repositoryId)) {
    throw new Error("Repository ID contains invalid characters");
  }

  return repositoryId;
};

const resolveRepositoryStoragePath = (repositoryId: string): string => {
  const safeRepositoryId = validateRepositoryId(repositoryId);
  const root = path.resolve(process.cwd(), "temp", "repositories");
  const resolved = path.resolve(root, safeRepositoryId);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Repository path is outside the repository root");
  }

  return resolved;
};

export const ensureRepositoryRootPath = async (
  repositoryId: string,
  create: boolean
): Promise<string> => {
  const repositoryRoot = getRepositoryRootPath(repositoryId);
  const storageRoot = path.resolve(process.cwd(), "temp", "repositories");

  if (create) {
    await fs.mkdir(storageRoot, { recursive: true });
  }

  const canonicalStorageRoot = await fs.realpath(storageRoot);
  const canonicalApplicationRoot = await fs.realpath(process.cwd());
  if (
    canonicalStorageRoot !== canonicalApplicationRoot &&
    !canonicalStorageRoot.startsWith(`${canonicalApplicationRoot}${path.sep}`)
  ) {
    throw new Error("Repository storage root is outside the application directory");
  }

  if (create) {
    await fs.mkdir(repositoryRoot, { recursive: true });
  }

  const canonicalRepositoryRoot = await fs.realpath(repositoryRoot);
  if (
    canonicalRepositoryRoot !== canonicalStorageRoot &&
    !canonicalRepositoryRoot.startsWith(`${canonicalStorageRoot}${path.sep}`)
  ) {
    throw new Error("Repository path is outside the repository storage root");
  }

  return canonicalRepositoryRoot;
};

export const getRepositorySnapshotPath = (repositoryId: string): string =>
  path.join(getRepositoryRootPath(repositoryId), "analysis.json");

export const ensureRepositoryAttemptPath = async (
  repositoryId: string,
  attemptId: string
): Promise<string> => {
  if (!/^[A-Za-z0-9-]+$/.test(attemptId)) {
    throw new Error("Repository attempt ID contains invalid characters");
  }

  const repositoryRoot = await ensureRepositoryRootPath(repositoryId, true);
  const attemptPath = path.join(repositoryRoot, "attempts", attemptId);
  await fs.mkdir(attemptPath, { recursive: true });
  const canonicalAttemptPath = await fs.realpath(attemptPath);
  if (!canonicalAttemptPath.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new Error("Repository attempt path is outside the repository root");
  }
  return canonicalAttemptPath;
};

export const getRepositoryAttemptPath = (repositoryId: string, attemptId: string): string => {
  if (!/^[A-Za-z0-9-]+$/.test(attemptId)) {
    throw new Error("Repository attempt ID contains invalid characters");
  }
  return path.join(getRepositoryRootPath(repositoryId), "attempts", attemptId);
};

export const saveRepositoryExplorerState = async (
  state: RepositoryExplorerState,
  options: { storagePath?: string; assertActive?: () => void } = {}
): Promise<void> => {
  const snapshot: SerializedRepositoryExplorerState = {
    repositoryId: state.repositoryId,
    repositoryPath: state.repositoryPath,
    summary: state.summary,
    knowledge: state.knowledge,
    workspaces: state.workspaces.map(serializeWorkspaceAnalysis),
  };

  options.assertActive?.();
  const storagePath = options.storagePath ?? await ensureRepositoryRootPath(state.repositoryId, true);

  const snapshotPath = path.join(storagePath, "analysis.json");
  const temporarySnapshotPath = `${snapshotPath}.${randomUUID()}.tmp`;
  const backupSnapshotPath = `${snapshotPath}.previous`;

  try {
    options.assertActive?.();
    await fs.writeFile(temporarySnapshotPath, JSON.stringify(snapshot, null, 2), "utf-8");
    let movedPrevious = false;
    try {
      await fs.access(snapshotPath);
      await fs.rm(backupSnapshotPath, { force: true });
      await fs.rename(snapshotPath, backupSnapshotPath);
      movedPrevious = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    try {
      options.assertActive?.();
      await fs.rename(temporarySnapshotPath, snapshotPath);
    } catch (error) {
      if (movedPrevious) {
        await fs.rename(backupSnapshotPath, snapshotPath).catch(() => undefined);
      }
      throw error;
    }

    await fs.rm(backupSnapshotPath, { force: true }).catch(error => {
      logger.warn("repository.snapshot_backup_cleanup_failed", { repositoryId: state.repositoryId, errorName: error instanceof Error ? error.name : "UnknownError" });
    });
  } finally {
    await fs.rm(temporarySnapshotPath, { force: true }).catch(() => undefined);
  }
};

export const loadRepositoryExplorerState = async (
  repositoryId: string
): Promise<RepositoryExplorerState | null> => {
  try {
    const safeRepositoryId = validateRepositoryId(repositoryId);
    const canonicalRepositoryRoot = await ensureRepositoryRootPath(safeRepositoryId, false);
    let activeAttemptId: string | null = null;
    try {
      const lifecycle = await prisma.repository.findUnique({
        where: { id: safeRepositoryId },
        select: { activeAttemptId: true },
      });
      activeAttemptId = lifecycle?.activeAttemptId ?? null;
    } catch {
      activeAttemptId = null;
    }

    const canonicalStoragePath = activeAttemptId
      ? await fs.realpath(getRepositoryAttemptPath(safeRepositoryId, activeAttemptId))
      : canonicalRepositoryRoot;
    if (canonicalStoragePath !== canonicalRepositoryRoot && !canonicalStoragePath.startsWith(`${canonicalRepositoryRoot}${path.sep}`)) {
      return null;
    }
    const snapshotPath = path.join(canonicalStoragePath, "analysis.json");
    const backupSnapshotPath = `${snapshotPath}.previous`;
    let parsed: SerializedRepositoryExplorerState;
    try {
      parsed = JSON.parse(await fs.readFile(snapshotPath, "utf-8")) as SerializedRepositoryExplorerState;
    } catch {
      parsed = JSON.parse(await fs.readFile(backupSnapshotPath, "utf-8")) as SerializedRepositoryExplorerState;
      await fs.rename(backupSnapshotPath, snapshotPath).catch(() => undefined);
    }

    if (parsed.repositoryId !== safeRepositoryId) {
      return null;
    }

    return {
      repositoryId: safeRepositoryId,
      // The snapshot is data, not an authority for filesystem locations.
      repositoryPath: canonicalStoragePath,
      summary: parsed.summary,
      knowledge: parsed.knowledge,
      workspaces: parsed.workspaces.map(deserializeWorkspaceAnalysis),
    };
  } catch {
    return null;
  }
};

const serializeWorkspaceAnalysis = (
  workspace: WorkspaceAnalysis
): SerializedWorkspaceAnalysis => ({
  ...workspace,
  globalSymbolTable: [...workspace.globalSymbolTable.entries()],
  sourceFiles: workspace.sourceFiles.map(sourceFile => ({
    ...sourceFile,
    symbolTable: [...sourceFile.symbolTable.entries()],
  })),
});

const deserializeWorkspaceAnalysis = (
  workspace: SerializedWorkspaceAnalysis
): WorkspaceAnalysis => ({
  ...workspace,
  globalSymbolTable: new Map(workspace.globalSymbolTable),
  sourceFiles: workspace.sourceFiles.map(sourceFile => ({
    ...sourceFile,
    symbolTable: new Map(sourceFile.symbolTable),
  })),
});
