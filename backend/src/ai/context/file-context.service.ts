import type { RepositoryExplorerState } from "../../services/repository-explorer-state.service";

export interface FileContextDependency {
  file: string;
  imports: string[];
}

export interface FileContextDeadCodeStatus {
  isDeadCode: boolean;
  unusedFunctions: string[];
  unusedExportedFunctions: string[];
  unreachableFunctions: string[];
}

export interface FileContext {
  repositoryId: string;
  workspace: string;
  path: string;
  language: string;
  extension: string;
  size: number;
  lineCount: number;
  imports: unknown[];
  exports: unknown[];
  functions: unknown[];
  classes: unknown[];
  interfaces: unknown[];
  enums: unknown[];
  variables: unknown[];
  methods: unknown[];
  typeAliases: unknown[];
  functionCalls: unknown[];
  dependencies: FileContextDependency[];
  deadCode: FileContextDeadCodeStatus;
  callGraph: {
    outgoing: string[];
    incoming: string[];
  };
}

export const buildFileContext = (
  state: RepositoryExplorerState,
  filePath: string
): FileContext | null => {
  const match = findSourceFile(state, normalizePath(filePath));
  if (!match) {
    return null;
  }

  const { workspace, sourceFile } = match;
  const ast = sourceFile.ast;

  const dependencyNode = workspace.dependencyGraph.nodes.find(node => node.file === sourceFile.relativePath);
  const outgoing = state.knowledge.callGraph.edges
    .filter(edge => edge.caller === sourceFile.relativePath || (ast?.functions.some(fn => fn.name === edge.caller) ?? false) || (ast?.methods.some(method => method.name === edge.caller) ?? false))
    .map(edge => edge.callee);
  const incoming = state.knowledge.callGraph.edges
    .filter(edge => edge.callee === sourceFile.relativePath || (ast?.functions.some(fn => fn.name === edge.callee) ?? false) || (ast?.methods.some(method => method.name === edge.callee) ?? false))
    .map(edge => edge.caller);

  const functionNames = new Set<string>([
    ...(ast?.functions.map(fn => fn.name) ?? []),
    ...(ast?.methods.map(method => method.name) ?? []),
  ]);

  const deadCode = {
    isDeadCode: false,
    unusedFunctions: state.knowledge.deadCode.unusedFunctions.filter(name => functionNames.has(name)),
    unusedExportedFunctions: state.knowledge.deadCode.unusedExportedFunctions.filter(name => functionNames.has(name)),
    unreachableFunctions: state.knowledge.deadCode.unreachableFunctions.filter(name => functionNames.has(name)),
  };

  deadCode.isDeadCode =
    deadCode.unusedFunctions.length > 0 ||
    deadCode.unusedExportedFunctions.length > 0 ||
    deadCode.unreachableFunctions.length > 0;

  return {
    repositoryId: state.repositoryId,
    workspace: workspace.name,
    path: sourceFile.relativePath,
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
    dependencies: dependencyNode ? [{ file: dependencyNode.file, imports: dependencyNode.imports }] : [],
    deadCode,
    callGraph: {
      outgoing: Array.from(new Set(outgoing)),
      incoming: Array.from(new Set(incoming)),
    },
  };
};

function findSourceFile(
  state: RepositoryExplorerState,
  normalizedPath: string
): { workspace: RepositoryExplorerState["workspaces"][number]; sourceFile: RepositoryExplorerState["workspaces"][number]["sourceFiles"][number] } | null {
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
