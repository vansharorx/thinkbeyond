import { AppError } from "../utils/AppError";
import { analyzeImpact } from "../analysis/impact/impact-analysis.service";
import { searchRepositoryExplorer } from "../analysis/search/search.service";
import { loadRepositoryExplorerState } from "./repository-explorer-state.service";
import { buildImpactResponse, findImpactTarget, resolveImpactTarget } from "./repository-impact.service";

export type NavigationResultType = "file" | "symbol" | "relationship";

export interface RepositoryNavigationResult {
  type: NavigationResultType;
  workspace?: string;
  path?: string;
  symbol?: string;
  kind?: string;
  source?: string;
  target?: string;
  score: number;
  reason: string;
  relationships?: Record<string, unknown>;
}

export interface RepositoryNavigationMetadata {
  intent: string;
  resultCount: number;
}

export interface RepositoryNavigationResponse {
  query: string;
  results: RepositoryNavigationResult[];
  metadata: RepositoryNavigationMetadata;
}

export const navigateRepositoryData = async (
  repositoryId: string,
  query: string
): Promise<RepositoryNavigationResponse | null> => {
  const state = await loadRepositoryExplorerState(repositoryId);
  if (!state) return null;

  const normalized = query.trim();
  if (!normalized) {
    throw new AppError("Query is required", 400);
  }

  const intent = inferNavigationIntent(normalized);
  const tokens = extractTokens(normalized);
  const results = new Map<string, RepositoryNavigationResult>();

  const searchResults = searchRepositoryExplorer(state.workspaces, normalized, {
    scope: "all",
    matchMode: "partial",
  });

  if (intent === "impact_navigation") {
    const impactInput = findImpactTarget(state, normalized);
    const impactTarget = impactInput ? resolveImpactTarget(state, impactInput) : null;
    if (impactTarget) {
      const impact = buildImpactResponse(state, impactTarget);
      for (const item of [...impact.directImpact, ...impact.indirectImpact]) {
        if (!item.path && !item.symbol) continue;
        addResult(results, {
          type: "relationship",
          workspace: findWorkspaceForPath(state, item.path),
          path: item.path,
          symbol: item.symbol,
          source: impactTarget.symbol ?? impactTarget.path,
          target: item.symbol ?? item.path,
          kind: item.relationship ?? "impact",
          score: item.distance === "direct" ? 0.94 : 0.82,
          reason: item.reason,
        });
      }
    }
  }

  for (const hit of searchResults.files) {
    const fileResult = buildFileResult(hit, normalized, tokens);
    addResult(results, fileResult);
  }

  for (const hit of [
    ...searchResults.functions,
    ...searchResults.classes,
    ...searchResults.interfaces,
    ...searchResults.enums,
    ...searchResults.variables,
    ...searchResults.typeAliases,
    ...searchResults.symbols,
  ]) {
    const symbolResult = buildSymbolResult(hit, normalized, tokens, state);
    addResult(results, symbolResult);
  }

  for (const workspace of state.workspaces) {
    for (const node of workspace.dependencyGraph.nodes) {
      if (!matchesQueryNode(node.file, normalized, tokens)) {
        continue;
      }

      for (const target of node.imports) {
        const result = buildRelationshipResult({
          type: "dependency",
          source: node.file,
          target,
          workspace: workspace.name,
          score: 0.8,
          reason: `File depends on ${target} and matches the query terms.`,
        });
        addResult(results, result);
      }
    }

    for (const node of workspace.reverseDependencyGraph.nodes) {
      if (!matchesQueryNode(node.file, normalized, tokens)) {
        continue;
      }

      for (const user of node.usedBy) {
        const result = buildRelationshipResult({
          type: "reverse_dependency",
          source: user,
          target: node.file,
          workspace: workspace.name,
          score: 0.78,
          reason: `${node.file} is used by ${user}, matching the dependency relationship.`,
        });
        addResult(results, result);
      }
    }
  }

  for (const edge of state.knowledge.callGraph.edges) {
    if (!matchesQueryNode(edge.caller, normalized, tokens) && !matchesQueryNode(edge.callee, normalized, tokens)) {
      continue;
    }

    const result = buildRelationshipResult({
      type: "calls",
      source: edge.caller,
      target: edge.callee,
      workspace: inferWorkspaceForSymbol(state, edge.caller) ?? inferWorkspaceForSymbol(state, edge.callee),
      score: 0.86,
      reason: `${edge.caller} calls ${edge.callee} and matches the navigation query.`,
    });
    addResult(results, result);
  }

  for (const symbolName of new Set(
    [
      ...searchResults.functions.map(item => item.name),
      ...searchResults.classes.map(item => item.name),
      ...searchResults.interfaces.map(item => item.name),
      ...searchResults.enums.map(item => item.name),
      ...searchResults.variables.map(item => item.name),
      ...searchResults.typeAliases.map(item => item.name),
      ...searchResults.symbols.map(item => item.name),
    ]
  )) {
    const impact = analyzeImpact(state.knowledge.callGraph, symbolName);
    if (!impact.directImpact.length && !impact.transitiveImpact.length) {
      continue;
    }

    const target = impact.directImpact[0] ?? impact.transitiveImpact[0];
    if (!target) {
      continue;
    }

    const result = buildRelationshipResult({
      type: "impact",
      source: symbolName,
      target,
      workspace: inferWorkspaceForSymbol(state, symbolName),
      score: 0.74,
      reason: `Changing ${symbolName} could affect ${target} in the call graph.`,
    });
    addResult(results, result);
  }

  const sorted = [...results.values()].sort((left, right) => right.score - left.score);
  const trimmed = sorted.slice(0, 10);

  return {
    query: normalized,
    results: trimmed,
    metadata: {
      intent,
      resultCount: trimmed.length,
    },
  };
};

function buildFileResult(hit: { workspace: string; name: string; path: string; kind: string; score: number }, query: string, tokens: string[]): RepositoryNavigationResult {
  const exactNameMatch = normalize(hit.name) === normalize(query);
  const score = exactNameMatch
    ? 0.96
    : Math.min(0.9, 0.65 + Math.min(0.2, tokens.length * 0.08) + (hit.score ?? 0) * 0.15);

  return {
    type: "file",
    workspace: hit.workspace,
    path: hit.path,
    kind: hit.kind,
    score,
    reason: exactNameMatch
      ? "Exact file path match."
      : `File path contains ${tokens.slice(0, 2).join(" or ")} terms.`,
  };
}

function buildSymbolResult(
  hit: { workspace: string; name: string; path: string; kind: string; score: number },
  query: string,
  tokens: string[],
  state: Awaited<ReturnType<typeof loadRepositoryExplorerState>> extends infer T ? NonNullable<T> : never
): RepositoryNavigationResult {
  const exactMatch = normalize(hit.name) === normalize(query);
  const file = findSymbolFile(state, hit.name) ?? hit.path;
  const callers = state.knowledge.callGraph.edges.filter(edge => edge.callee === hit.name).map(edge => edge.caller);
  const callees = state.knowledge.callGraph.edges.filter(edge => edge.caller === hit.name).map(edge => edge.callee);

  const score = exactMatch
    ? 0.98
    : Math.min(0.93, 0.7 + Math.min(0.2, tokens.length * 0.08) + (callers.length + callees.length) * 0.02);

  return {
    type: "symbol",
    workspace: hit.workspace,
    path: file,
    symbol: hit.name,
    kind: hit.kind,
    score,
    reason: exactMatch
      ? "Exact symbol match."
      : callers.length || callees.length
        ? `${hit.name} is connected through ${callers.length + callees.length} call-graph relationships.`
        : `Symbol name matches ${tokens.slice(0, 2).join(" or ")} terms.`,
    relationships: {
      callers,
      callees,
    },
  };
}

function buildRelationshipResult({
  type,
  source,
  target,
  workspace,
  score,
  reason,
}: {
  type: string;
  source: string;
  target: string;
  workspace?: string;
  score: number;
  reason: string;
}): RepositoryNavigationResult {
  return {
    type: "relationship",
    workspace,
    source,
    target,
    kind: type,
    score,
    reason,
  };
}

function addResult(results: Map<string, RepositoryNavigationResult>, result: RepositoryNavigationResult): void {
  const key = result.type === "relationship"
    ? `relationship:${result.kind ?? "unknown"}:${result.source ?? ""}:${result.target ?? ""}`
    : `${result.type}:${result.workspace ?? ""}:${result.path ?? ""}:${result.symbol ?? ""}`;

  const existing = results.get(key);
  if (!existing || result.score > existing.score) {
    results.set(key, result);
  }
}

function inferNavigationIntent(query: string): string {
  const normalized = query.toLowerCase();
  if (/what calls|who calls|called by|callers|callee|trace/.test(normalized)) return "call_navigation";
  if (/depend on|depends on|used by|reverse depend|which files depend/.test(normalized)) return "dependency_navigation";
  if (/what breaks|affected|impact|change .*|risk/.test(normalized)) return "impact_navigation";
  if (/where is|find|show me|which files|what is/.test(normalized)) return "repository_navigation";
  return "repository_navigation";
}

function matchesQueryNode(value: string, query: string, tokens: string[]): boolean {
  const normalized = normalize(value);
  if (!normalized) return false;
  if (normalized === normalize(query)) return true;
  if (tokens.some(token => normalized.includes(token))) return true;
  return false;
}

function extractTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s_/.-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => token.length > 2)
    .slice(0, 6);
}

function normalize(value: string): string {
  return value.trim().replace(/\\/g, "/").toLowerCase();
}

function inferWorkspaceForSymbol(state: Awaited<ReturnType<typeof loadRepositoryExplorerState>> extends infer T ? NonNullable<T> : never, symbolName: string): string | undefined {
  for (const workspace of state.workspaces) {
    for (const sourceFile of workspace.sourceFiles) {
      if (sourceFile.symbolTable.has(symbolName)) {
        return workspace.name;
      }
    }
  }
  return undefined;
}

function findSymbolFile(state: Awaited<ReturnType<typeof loadRepositoryExplorerState>> extends infer T ? NonNullable<T> : never, symbolName: string): string | undefined {
  for (const workspace of state.workspaces) {
    for (const sourceFile of workspace.sourceFiles) {
      if (sourceFile.symbolTable.has(symbolName)) {
        return sourceFile.relativePath;
      }
    }
  }
  return undefined;
}

function findWorkspaceForPath(state: Awaited<ReturnType<typeof loadRepositoryExplorerState>> extends infer T ? NonNullable<T> : never, filePath?: string): string | undefined {
  if (!filePath) return undefined;
  for (const workspace of state.workspaces) {
    if (workspace.sourceFiles.some(sourceFile => normalize(sourceFile.relativePath) === normalize(filePath))) {
      return workspace.name;
    }
  }
  return undefined;
}
