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
  path.join(process.cwd(), "temp", "repositories", repositoryId);

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

  await fs.mkdir(getRepositoryRootPath(state.repositoryId), {
    recursive: true,
  });

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
    const raw = await fs.readFile(
      getRepositorySnapshotPath(repositoryId),
      "utf-8"
    );

    const parsed = JSON.parse(raw) as SerializedRepositoryExplorerState;

    return {
      repositoryId: parsed.repositoryId,
      repositoryPath: parsed.repositoryPath,
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
