import fs from "fs/promises";
import path from "path";

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

export const saveRepositoryExplorerState = async (
  state: RepositoryExplorerState
): Promise<void> => {
  const snapshot: SerializedRepositoryExplorerState = {
    repositoryId: state.repositoryId,
    repositoryPath: state.repositoryPath,
    summary: state.summary,
    knowledge: state.knowledge,
    workspaces: state.workspaces.map(serializeWorkspaceAnalysis),
  };

  await ensureRepositoryRootPath(state.repositoryId, true);

  await fs.writeFile(
    getRepositorySnapshotPath(state.repositoryId),
    JSON.stringify(snapshot, null, 2),
    "utf-8"
  );
};

export const loadRepositoryExplorerState = async (
  repositoryId: string
): Promise<RepositoryExplorerState | null> => {
  try {
    const safeRepositoryId = validateRepositoryId(repositoryId);
    const canonicalRepositoryRoot = await ensureRepositoryRootPath(safeRepositoryId, false);
    const raw = await fs.readFile(
      getRepositorySnapshotPath(safeRepositoryId),
      "utf-8"
    );

    const parsed = JSON.parse(raw) as SerializedRepositoryExplorerState;

    if (parsed.repositoryId !== safeRepositoryId) {
      return null;
    }

    return {
      repositoryId: safeRepositoryId,
      // The snapshot is data, not an authority for filesystem locations.
      repositoryPath: canonicalRepositoryRoot,
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
