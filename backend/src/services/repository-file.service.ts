import type { RepositoryFileResponse } from "../types/explorer.types";
import type { RepositoryExplorerState } from "./repository-explorer-state.service";
import { loadRepositoryExplorerState } from "./repository-explorer-state.service";

interface SourceFileMatch {
  workspace: RepositoryExplorerState["workspaces"][number];
  sourceFile: RepositoryExplorerState["workspaces"][number]["sourceFiles"][number];
}

export const getRepositoryFileDetails = async (
  repositoryId: string,
  filePath: string
): Promise<RepositoryFileResponse | null> => {
  const state = await loadRepositoryExplorerState(repositoryId);
  if (!state) {
    return null;
  }

  const normalizedPath = normalizePath(filePath);
  const match = findSourceFile(state, normalizedPath);

  if (!match) {
    return null;
  }

  const { workspace, sourceFile } = match;
  const ast = sourceFile.ast;
  const functionNames = new Set<string>([
    ...((ast?.functions ?? []).map(fn => fn.name)),
    ...((ast?.methods ?? []).map(method => method.name)),
  ]);

  const dependencies =
    workspace.dependencyGraph.nodes.find(node => node.file === sourceFile.relativePath)
      ?.imports ?? [];

  const deadCode = {
    unusedFunctions: state.knowledge.deadCode.unusedFunctions.filter(name => functionNames.has(name)),
    unusedExportedFunctions: state.knowledge.deadCode.unusedExportedFunctions.filter(name => functionNames.has(name)),
    unreachableFunctions: state.knowledge.deadCode.unreachableFunctions.filter(name => functionNames.has(name)),
  };

  const hasDeadCode =
    deadCode.unusedFunctions.length > 0 ||
    deadCode.unusedExportedFunctions.length > 0 ||
    deadCode.unreachableFunctions.length > 0;

  return {
    repositoryId,
    workspace: workspace.name,
    path: sourceFile.relativePath,
    file: {
      name: sourceFile.relativePath.split("/").pop() ?? sourceFile.relativePath,
      language: inferLanguage(sourceFile.extension),
      extension: sourceFile.extension,
      size: sourceFile.size,
      lineCount: sourceFile.lines,
      imports: sourceFile.imports,
      exports: sourceFile.exports,
      functions: ast?.functions ?? [],
      classes: ast?.classes ?? [],
      interfaces: ast?.interfaces ?? [],
      enums: ast?.enums ?? [],
      variables: ast?.variables ?? [],
      methods: ast?.methods ?? [],
      typeAliases: ast?.typeAliases ?? [],
      functionCalls: ast?.functionCalls ?? [],
      dependencies,
      deadCode: {
        isDeadCode: hasDeadCode,
        ...deadCode,
      },
    },
  };
};

function findSourceFile(
  state: RepositoryExplorerState,
  normalizedPath: string
): SourceFileMatch | null {
  for (const workspace of state.workspaces) {
    for (const sourceFile of workspace.sourceFiles) {
      if (normalizePath(sourceFile.relativePath) === normalizedPath) {
        return { workspace, sourceFile };
      }
    }
  }

  return null;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/?/, "");
}

function inferLanguage(extension: string): string {
  switch (extension.toLowerCase()) {
    case ".ts":
    case ".tsx":
      return "TypeScript";
    case ".js":
    case ".jsx":
      return "JavaScript";
    case ".json":
      return "JSON";
    default:
      return "Unknown";
  }
}
