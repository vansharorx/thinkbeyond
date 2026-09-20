import type { GlobalSymbolInfo } from "../analysis/symbols/global-symbol-table.service";
import type { SymbolInfo } from "../analysis/symbols/symbol-table.service";
import { getRepositoryImpact, type RepositoryImpactResponse } from "./repository-impact.service";
import { loadRepositoryExplorerState, type RepositoryExplorerState } from "./repository-explorer-state.service";

export const SYMBOL_OPERATIONS = [
  "overview",
  "callers",
  "callees",
  "neighborhood",
  "impact",
  "references",
  "search",
] as const;

export type SymbolOperation = typeof SYMBOL_OPERATIONS[number];
export type SymbolKind = SymbolInfo["kind"];

export interface RepositorySymbolRequest {
  symbolName?: string;
  filePath?: string;
  query?: string;
  kind?: SymbolKind;
  workspace?: string;
  operation?: SymbolOperation;
}

export interface SymbolIntelligenceRecord {
  name: string;
  kind: SymbolKind;
  filePath: string;
  workspace: string;
  line: number;
  endLine: number;
  exported: boolean;
  parentSymbol?: string;
  signature?: string;
  callers: string[];
  callees: string[];
  dependencies: string[];
  dependents: string[];
  references: string[];
  relatedSymbols: string[];
  impact?: RepositoryImpactResponse;
  metadata: {
    source: "persisted-repository-analysis";
    architecture?: string;
    patterns?: string[];
  };
}

export interface SymbolMatch {
  name: string;
  kind: SymbolKind;
  filePath: string;
  workspace: string;
  line: number;
  endLine: number;
  exported: boolean;
  score: number;
}

export interface SymbolRelationship {
  source: string;
  target: string;
  type: "calls" | "called_by" | "depends_on" | "used_by" | "contains" | "related_to" | "impacts";
}

export interface SymbolNeighborhood {
  center: SymbolIntelligenceRecord;
  nodes: Array<{
    id: string;
    type: "symbol" | "file";
    path?: string;
    symbol?: string;
  }>;
  relationships: SymbolRelationship[];
}

export interface SymbolIntelligenceResponse {
  repositoryId: string;
  operation: SymbolOperation;
  symbol?: SymbolIntelligenceRecord;
  search?: SymbolMatch[];
  neighborhood?: SymbolNeighborhood;
  ambiguous?: {
    matches: SymbolMatch[];
  };
}

interface SymbolCandidate {
  workspace: RepositoryExplorerState["workspaces"][number];
  sourceFile: RepositoryExplorerState["workspaces"][number]["sourceFiles"][number];
  symbol: GlobalSymbolInfo;
}

export const getRepositorySymbolIntelligence = async (
  repositoryId: string,
  request: RepositorySymbolRequest
): Promise<SymbolIntelligenceResponse | null> => {
  const state = await loadRepositoryExplorerState(repositoryId);
  if (!state) return null;

  const operation = request.operation ?? (request.query ? "search" : "overview");
  if (operation === "search") {
    return {
      repositoryId,
      operation,
      search: searchRepositorySymbols(state, request),
    };
  }

  const candidates = resolveCandidates(state, request);
  if (candidates.length === 0) {
    return {
      repositoryId,
      operation,
    };
  }

  if (candidates.length > 1) {
    return {
      repositoryId,
      operation,
      ambiguous: {
        matches: candidates.map(candidate => toMatch(candidate, 1)),
      },
    };
  }

  const record = await buildSymbolRecord(state, candidates[0], operation === "impact" || operation === "neighborhood");
  const response: SymbolIntelligenceResponse = {
    repositoryId,
    operation,
    symbol: record,
  };

  if (operation === "neighborhood") {
    response.neighborhood = buildNeighborhood(record);
  }

  return response;
};

function resolveCandidates(
  state: RepositoryExplorerState,
  request: RepositorySymbolRequest
): SymbolCandidate[] {
  const name = request.symbolName?.trim().toLowerCase();
  if (!name) return [];

  return allCandidates(state).filter(candidate => {
    if (candidate.symbol.name.toLowerCase() !== name) return false;
    if (request.filePath && !samePath(candidate.sourceFile.relativePath, request.filePath)) return false;
    if (request.workspace && candidate.workspace.name.toLowerCase() !== request.workspace.toLowerCase()) return false;
    if (request.kind && candidate.symbol.kind !== request.kind) return false;
    return true;
  });
}

export function searchRepositorySymbols(
  state: RepositoryExplorerState,
  request: RepositorySymbolRequest
): SymbolMatch[] {
  const query = (request.query ?? request.symbolName ?? "").trim().toLowerCase();
  if (!query) return [];

  const matches = allCandidates(state)
    .filter(candidate => !request.kind || candidate.symbol.kind === request.kind)
    .filter(candidate => !request.filePath || samePath(candidate.sourceFile.relativePath, request.filePath))
    .filter(candidate => !request.workspace || candidate.workspace.name.toLowerCase() === request.workspace.toLowerCase())
    .map(candidate => {
      const symbolName = candidate.symbol.name.toLowerCase();
      const path = candidate.sourceFile.relativePath.toLowerCase();
      const exact = symbolName === query;
      const prefix = symbolName.startsWith(query);
      const substring = symbolName.includes(query);
      const pathMatch = path.includes(query);
      const score = exact ? 100 : prefix ? 80 : substring ? 60 : pathMatch ? 40 : 0;
      return { candidate, score: score + (request.kind ? 10 : 0) };
    })
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || left.candidate.symbol.name.localeCompare(right.candidate.symbol.name) || left.candidate.sourceFile.relativePath.localeCompare(right.candidate.sourceFile.relativePath));

  const deduplicated = new Map<string, SymbolMatch>();
  for (const item of matches) {
    const result = toMatch(item.candidate, item.score);
    const key = `${result.workspace}|${result.filePath}|${result.name}|${result.kind}`;
    if (!deduplicated.has(key)) deduplicated.set(key, result);
  }
  return [...deduplicated.values()];
}

async function buildSymbolRecord(
  state: RepositoryExplorerState,
  candidate: SymbolCandidate,
  includeImpact: boolean
): Promise<SymbolIntelligenceRecord> {
  const { workspace, sourceFile, symbol } = candidate;
  const callers = unique(state.knowledge.callGraph.edges.filter(edge => edge.callee === symbol.name).map(edge => edge.caller));
  const callees = unique(state.knowledge.callGraph.edges.filter(edge => edge.caller === symbol.name).map(edge => edge.callee));
  const dependencyNode = workspace.dependencyGraph.nodes.find(node => samePath(node.file, sourceFile.relativePath));
  const reverseNode = workspace.reverseDependencyGraph.nodes.find(node => samePath(node.file, sourceFile.relativePath));
  const dependencies = unique(dependencyNode?.imports ?? []);
  const dependents = unique(reverseNode?.usedBy ?? []);
  const parentSymbol = findParentSymbol(sourceFile, symbol);
  const relatedSymbols = unique([...callers, ...callees, ...symbolsInSameFile(sourceFile, symbol.name), ...(parentSymbol ? [parentSymbol] : [])]);
  const impact = includeImpact
    ? await getRepositoryImpact(state.repositoryId, { filePath: sourceFile.relativePath, symbolName: symbol.name }) ?? undefined
    : undefined;

  return {
    name: symbol.name,
    kind: symbol.kind,
    filePath: sourceFile.relativePath,
    workspace: workspace.name,
    line: symbol.startLine,
    endLine: symbol.endLine,
    exported: symbol.exported,
    ...(parentSymbol ? { parentSymbol } : {}),
    ...(buildSignature(sourceFile, symbol) ? { signature: buildSignature(sourceFile, symbol) } : {}),
    callers,
    callees,
    dependencies,
    dependents,
    references: [],
    relatedSymbols,
    ...(impact ? { impact } : {}),
    metadata: {
      source: "persisted-repository-analysis",
      architecture: workspace.architecture.architecture,
      patterns: workspace.architecture.patterns,
    },
  };
}

function buildNeighborhood(record: SymbolIntelligenceRecord): SymbolNeighborhood {
  const nodes = new Map<string, SymbolNeighborhood["nodes"][number]>();
  const relationships: SymbolRelationship[] = [];
  const centerId = symbolId(record.workspace, record.filePath, record.name);
  nodes.set(centerId, { id: centerId, type: "symbol", path: record.filePath, symbol: record.name });

  const addSymbol = (name: string, type: SymbolRelationship["type"]): void => {
    const id = `${type}:${name}`;
    nodes.set(id, { id, type: "symbol", symbol: name });
    relationships.push({ source: centerId, target: id, type });
  };
  const addFile = (path: string, type: "depends_on" | "used_by"): void => {
    const id = `${type}:${path}`;
    nodes.set(id, { id, type: "file", path });
    relationships.push({ source: centerId, target: id, type });
  };

  record.callers.forEach(name => addSymbol(name, "called_by"));
  record.callees.forEach(name => addSymbol(name, "calls"));
  record.dependencies.forEach(path => addFile(path, "depends_on"));
  record.dependents.forEach(path => addFile(path, "used_by"));
  if (record.parentSymbol) addSymbol(record.parentSymbol, "related_to");
  record.relatedSymbols.forEach(name => {
    if (name !== record.parentSymbol && !record.callers.includes(name) && !record.callees.includes(name)) addSymbol(name, "related_to");
  });
  for (const item of record.impact?.directImpact ?? []) {
    const target = item.symbol ?? item.path;
    if (!target) continue;
    const id = `impact:${target}`;
    nodes.set(id, { id, type: item.symbol ? "symbol" : "file", path: item.path, symbol: item.symbol });
    relationships.push({ source: centerId, target: id, type: "impacts" });
  }

  return { center: record, nodes: [...nodes.values()], relationships: dedupeRelationships(relationships) };
}

function allCandidates(state: RepositoryExplorerState): SymbolCandidate[] {
  const candidates: SymbolCandidate[] = [];
  for (const workspace of state.workspaces) {
    for (const sourceFile of workspace.sourceFiles) {
      for (const symbol of sourceFile.symbolTable.values()) {
        candidates.push({
          workspace,
          sourceFile,
          symbol: {
            ...symbol,
            file: sourceFile.relativePath,
          },
        });
      }
    }
  }
  return candidates;
}

function toMatch(candidate: SymbolCandidate, score: number): SymbolMatch {
  return {
    name: candidate.symbol.name,
    kind: candidate.symbol.kind,
    filePath: candidate.sourceFile.relativePath,
    workspace: candidate.workspace.name,
    line: candidate.symbol.startLine,
    endLine: candidate.symbol.endLine,
    exported: candidate.symbol.exported,
    score,
  };
}

function findParentSymbol(sourceFile: SymbolCandidate["sourceFile"], symbol: GlobalSymbolInfo): string | undefined {
  if (symbol.kind !== "method") return undefined;
  const parent = sourceFile.ast?.classes.find(item => item.startLine <= symbol.startLine && item.endLine >= symbol.endLine);
  return parent?.name;
}

function symbolsInSameFile(sourceFile: SymbolCandidate["sourceFile"], excludedName: string): string[] {
  return [...sourceFile.symbolTable.values()]
    .filter(symbol => symbol.name !== excludedName)
    .map(symbol => symbol.name);
}

function buildSignature(sourceFile: SymbolCandidate["sourceFile"], symbol: GlobalSymbolInfo): string | undefined {
  if (symbol.kind === "function") {
    const info = sourceFile.ast?.functions.find(item => item.name === symbol.name && item.startLine === symbol.startLine);
    return info ? `${info.async ? "async " : ""}function ${info.name}(${info.parameters.join(", ")})${info.returnType ? `: ${info.returnType}` : ""}` : undefined;
  }
  if (symbol.kind === "method") {
    const info = sourceFile.ast?.methods.find(item => item.name === symbol.name && item.startLine === symbol.startLine);
    return info ? `${info.visibility}${info.static ? " static" : ""} ${info.async ? "async " : ""}${info.name}(${info.parameters.join(", ")})${info.returnType ? `: ${info.returnType}` : ""}` : undefined;
  }
  return undefined;
}

function symbolId(workspace: string, filePath: string, name: string): string {
  return `symbol:${workspace}:${filePath}:${name}`;
}

function dedupeRelationships(relationships: SymbolRelationship[]): SymbolRelationship[] {
  const seen = new Set<string>();
  return relationships.filter(relationship => {
    const key = `${relationship.source}|${relationship.target}|${relationship.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function samePath(left: string, right: string): boolean {
  return left.trim().replace(/\\/g, "/").toLowerCase() === right.trim().replace(/\\/g, "/").toLowerCase();
}
