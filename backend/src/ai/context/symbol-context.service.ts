import type { RepositoryExplorerState } from "../../services/repository-explorer-state.service";
import { analyzeImpact } from "../../analysis/impact/impact-analysis.service";

export interface SymbolReference {
  workspace: string;
  file: string;
  line: number;
  kind: string;
}

export interface SymbolContext {
  repositoryId: string;
  name: string;
  kind: string;
  file: string;
  line: number;
  exported: boolean;
  parameters: string[];
  returnType: string | null;
  definition: {
    startLine: number;
    endLine: number;
  };
  references: SymbolReference[];
  callers: string[];
  callees: string[];
  impact: ReturnType<typeof analyzeImpact>;
}

export const buildSymbolContext = (
  state: RepositoryExplorerState,
  symbolName: string,
  matchMode: "exact" | "partial" = "exact"
): SymbolContext | null => {
  const normalized = normalize(symbolName);
  const matches = findMatches(state, normalized, matchMode);
  const primary = matches[0];

  if (!primary) {
    return null;
  }

  const impact = analyzeImpact(state.knowledge.callGraph, primary.symbol.name);

  return {
    repositoryId: state.repositoryId,
    name: primary.symbol.name,
    kind: primary.symbol.kind,
    file: primary.sourceFile.relativePath,
    line: primary.symbol.startLine,
    exported: primary.symbol.exported,
    parameters: collectParameters(primary.sourceFile, primary.symbol.name),
    returnType: collectReturnType(primary.sourceFile, primary.symbol.name),
    definition: {
      startLine: primary.symbol.startLine,
      endLine: primary.symbol.endLine,
    },
    references: collectReferences(state, primary.symbol.name),
    callers: impact.callers,
    callees: impact.callees,
    impact,
  };
};

function findMatches(
  state: RepositoryExplorerState,
  query: string,
  matchMode: "exact" | "partial"
): Array<{ workspace: RepositoryExplorerState["workspaces"][number]; sourceFile: RepositoryExplorerState["workspaces"][number]["sourceFiles"][number]; symbol: RepositoryExplorerState["workspaces"][number]["sourceFiles"][number]["symbolTable"] extends Map<string, infer T> ? T : never }> {
  const matches: Array<{ workspace: RepositoryExplorerState["workspaces"][number]; sourceFile: RepositoryExplorerState["workspaces"][number]["sourceFiles"][number]; symbol: any }> = [];

  for (const workspace of state.workspaces) {
    for (const sourceFile of workspace.sourceFiles) {
      for (const [name, symbol] of sourceFile.symbolTable) {
        if (matchesQuery(name, query, matchMode)) {
          matches.push({ workspace, sourceFile, symbol });
        }
      }
    }
  }

  return matches;
}

function collectReferences(state: RepositoryExplorerState, name: string): SymbolReference[] {
  const references: SymbolReference[] = [];

  for (const workspace of state.workspaces) {
    for (const sourceFile of workspace.sourceFiles) {
      const symbol = sourceFile.symbolTable.get(name);
      if (symbol) {
        references.push({
          workspace: workspace.name,
          file: sourceFile.relativePath,
          line: symbol.startLine,
          kind: symbol.kind,
        });
      }
    }
  }

  return references;
}

function collectParameters(
  sourceFile: RepositoryExplorerState["workspaces"][number]["sourceFiles"][number],
  symbolName: string
): string[] {
  const ast = sourceFile.ast;
  if (!ast) {
    return [];
  }

  const fn = ast.functions.find(item => item.name === symbolName);
  if (fn) {
    return fn.parameters;
  }

  const method = ast.methods.find(item => item.name === symbolName);
  if (method) {
    return method.parameters;
  }

  return [];
}

function collectReturnType(
  sourceFile: RepositoryExplorerState["workspaces"][number]["sourceFiles"][number],
  symbolName: string
): string | null {
  const ast = sourceFile.ast;
  if (!ast) {
    return null;
  }

  const fn = ast.functions.find(item => item.name === symbolName);
  if (fn) {
    return fn.returnType;
  }

  const method = ast.methods.find(item => item.name === symbolName);
  if (method) {
    return method.returnType;
  }

  return null;
}

function matchesQuery(
  value: string,
  query: string,
  matchMode: "exact" | "partial"
): boolean {
  const normalizedValue = normalize(value);
  return matchMode === "exact" ? normalizedValue === query : normalizedValue.includes(query);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
