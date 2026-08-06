import { loadRepositoryExplorerState } from "./repository-explorer-state.service";

export interface SymbolExplorerReference {
  workspace: string;
  file: string;
  line: number;
  kind: string;
}

export interface SymbolExplorerCounter {
  name: string;
  count: number;
}

export interface SymbolExplorerMatch {
  name: string;
  kind: string;
  file: string;
  line: number;
  exported: boolean;
  parameters: string[];
  returnType: string | null;
  references: SymbolExplorerReference[];
  callers: SymbolExplorerCounter[];
  callees: SymbolExplorerCounter[];
}

export interface SymbolExplorerResponse {
  repositoryId: string;
  query: string;
  matchMode: "exact" | "partial";
  matches: SymbolExplorerMatch[];
}

export const getSymbolDetails = async (
  repositoryId: string,
  query: string,
  matchMode: "exact" | "partial" = "exact"
): Promise<SymbolExplorerResponse | null> => {
  const state = await loadRepositoryExplorerState(repositoryId);
  if (!state) {
    return null;
  }

  const normalizedQuery = normalize(query);
  const matches: SymbolExplorerMatch[] = [];

  for (const workspace of state.workspaces) {
    for (const sourceFile of workspace.sourceFiles) {
      for (const [symbolName, symbol] of sourceFile.symbolTable) {
        if (!matchesQuery(symbolName, normalizedQuery, matchMode)) {
          continue;
        }

        const references = collectReferences(state.workspaces, symbolName, workspace.name, sourceFile.relativePath, symbol.kind);
        const callers = collectRelatedCounts(state.knowledge.callGraph.edges, symbolName, "callee");
        const callees = collectRelatedCounts(state.knowledge.callGraph.edges, symbolName, "caller");

        matches.push({
          name: symbol.name,
          kind: symbol.kind,
          file: sourceFile.relativePath,
          line: symbol.startLine,
          exported: symbol.exported,
          parameters: collectParameters(sourceFile, symbolName),
          returnType: collectReturnType(sourceFile, symbolName),
          references,
          callers,
          callees,
        });
      }
    }
  }

  return {
    repositoryId,
    query,
    matchMode,
    matches,
  };
};

function collectParameters(sourceFile: { ast: { functions: Array<{ name: string; parameters: string[]; returnType: string | null }>; methods: Array<{ name: string; parameters: string[]; returnType: string | null }> } | null }, symbolName: string): string[] {
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

function collectReturnType(sourceFile: { ast: { functions: Array<{ name: string; returnType: string | null }>; methods: Array<{ name: string; returnType: string | null }> } | null }, symbolName: string): string | null {
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

function collectReferences(
  workspaces: Array<{ name: string; sourceFiles: Array<{ relativePath: string; symbolTable: Map<string, { kind: string; startLine: number }> }> }>,
  symbolName: string,
  workspaceName: string,
  filePath: string,
  kind: string
): SymbolExplorerReference[] {
  const references: SymbolExplorerReference[] = [];

  for (const workspace of workspaces) {
    for (const sourceFile of workspace.sourceFiles) {
      const symbol = sourceFile.symbolTable.get(symbolName);
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

  if (references.length === 0) {
    references.push({
      workspace: workspaceName,
      file: filePath,
      line: 0,
      kind,
    });
  }

  return dedupeReferences(references);
}

function collectRelatedCounts(
  edges: Array<{ caller: string; callee: string }>,
  symbolName: string,
  direction: "caller" | "callee"
): SymbolExplorerCounter[] {
  const counts = new Map<string, number>();

  for (const edge of edges) {
    const match = direction === "caller" ? edge.callee === symbolName : edge.caller === symbolName;
    if (!match) {
      continue;
    }

    const related = direction === "caller" ? edge.caller : edge.callee;
    counts.set(related, (counts.get(related) ?? 0) + 1);
  }

  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

function matchesQuery(
  value: string,
  query: string,
  matchMode: "exact" | "partial"
): boolean {
  const normalizedValue = normalize(value);
  return matchMode === "exact"
    ? normalizedValue === query
    : normalizedValue.includes(query);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function dedupeReferences(references: SymbolExplorerReference[]): SymbolExplorerReference[] {
  const seen = new Set<string>();
  const deduped: SymbolExplorerReference[] = [];

  for (const reference of references) {
    const key = `${reference.workspace}:${reference.file}:${reference.line}:${reference.kind}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(reference);
  }

  return deduped;
}
