import { analyzeImpact, type ImpactResult } from "../analysis/impact/impact-analysis.service";
import type { RepositoryExplorerState } from "./repository-explorer-state.service";
import { loadRepositoryExplorerState } from "./repository-explorer-state.service";

export type ImpactTargetType = "file" | "symbol";
export type ImpactRiskLevel = "low" | "medium" | "high";

export interface RepositoryImpactItem {
  type: "file" | "symbol" | "relationship";
  path?: string;
  symbol?: string;
  kind?: string;
  relationship?: string;
  distance: "direct" | "indirect";
  reason: string;
}

export interface RepositoryImpactTarget {
  type: ImpactTargetType;
  path: string;
  symbol?: string;
  kind?: string;
}

export interface RepositoryImpactRisk {
  level: ImpactRiskLevel;
  score: number;
  reasons: string[];
}

export interface RepositoryImpactResponse {
  repositoryId: string;
  target: RepositoryImpactTarget;
  directImpact: RepositoryImpactItem[];
  indirectImpact: RepositoryImpactItem[];
  callers: string[];
  callees: string[];
  dependents: string[];
  dependencies: string[];
  architectureImpact: Array<{ workspace: string; architecture: unknown; patterns: string[] }>;
  risk: RepositoryImpactRisk;
}

export interface ImpactTargetInput {
  filePath?: string;
  symbolName?: string;
}

export const getRepositoryImpact = async (
  repositoryId: string,
  input: ImpactTargetInput
): Promise<RepositoryImpactResponse | null> => {
  const state = await loadRepositoryExplorerState(repositoryId);
  if (!state) return null;

  const target = resolveImpactTarget(state, input);
  if (!target) return null;

  return buildImpactResponse(state, target);
};

export const findImpactTarget = (
  state: RepositoryExplorerState,
  query: string
): ImpactTargetInput | null => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return null;

  const fileMatches = state.workspaces
    .flatMap(workspace => workspace.sourceFiles.map(sourceFile => sourceFile.relativePath))
    .filter(filePath => normalizedQuery.includes(normalize(filePath)));
  if (fileMatches.length > 0) {
    return { filePath: fileMatches[0] };
  }

  const symbolMatch = findSymbolMatches(state, "")
    .filter(match => normalizedQuery.includes(normalize(match.name)))
    .sort((left, right) => right.name.length - left.name.length)[0];
  if (symbolMatch) {
    return { filePath: symbolMatch.path, symbolName: symbolMatch.name };
  }

  return null;
};

export const buildImpactResponse = (
  state: RepositoryExplorerState,
  target: RepositoryImpactTarget
): RepositoryImpactResponse => {
  const fileInfo = findFile(state, target.path);
  const workspace = fileInfo?.workspace;
  const dependencyNode = workspace?.dependencyGraph.nodes.find(node => samePath(node.file, target.path));
  const reverseNode = workspace?.reverseDependencyGraph.nodes.find(node => samePath(node.file, target.path));
  const dependencies = dependencyNode?.imports ?? [];
  const dependents = reverseNode?.usedBy ?? [];

  const directImpact: RepositoryImpactItem[] = [
    ...dependencies.map(path => ({
      type: "file" as const,
      path,
      distance: "direct" as const,
      relationship: "depends_on",
      reason: `${target.path} depends on this file.`,
    })),
    ...dependents.map(path => ({
      type: "file" as const,
      path,
      distance: "direct" as const,
      relationship: "used_by",
      reason: `This file is a direct dependency of ${path}.`,
    })),
  ];

  const indirectImpact = buildTransitiveFileImpact(state, target.path, new Set([
    target.path,
    ...dependencies,
    ...dependents,
  ]));

  let callers: string[] = [];
  let callees: string[] = [];
  let symbolImpact: ImpactResult | null = null;
  if (target.symbol) {
    symbolImpact = analyzeImpact(state.knowledge.callGraph, target.symbol);
    callers = symbolImpact.callers;
    callees = symbolImpact.callees;

    directImpact.push(
      ...callers.map(symbol => symbolItem(state, symbol, "direct", `This symbol calls ${target.symbol}.`)),
      ...callees.map(symbol => symbolItem(state, symbol, "direct", `${target.symbol} calls this symbol.`)),
    );
    indirectImpact.push(
      ...symbolImpact.transitiveImpact
        .filter(symbol => !symbolImpact!.directImpact.includes(symbol))
        .map(symbol => symbolItem(state, symbol, "indirect", `This symbol is transitively connected to ${target.symbol}.`)),
    );
  }

  const architectureImpact = workspace
    ? [{
      workspace: workspace.name,
      architecture: workspace.architecture.architecture,
      patterns: workspace.architecture.patterns,
    }]
    : [];
  const cycles = workspace?.circularDependencies.cycles.filter(cycle =>
    cycle.cycle.some(path => samePath(path, target.path))
  ) ?? [];
  const risk = calculateRisk({
    directCount: uniqueImpactCount(directImpact),
    indirectCount: uniqueImpactCount(indirectImpact),
    callerCount: callers.length,
    calleeCount: callees.length,
    cycleCount: cycles.length,
    architectureCount: architectureImpact.length,
  });

  return {
    repositoryId: state.repositoryId,
    target,
    directImpact: dedupeImpact(directImpact),
    indirectImpact: dedupeImpact(indirectImpact),
    callers,
    callees,
    dependents: unique(dependents),
    dependencies: unique(dependencies),
    architectureImpact,
    risk,
  };
};

export const resolveImpactTarget = (
  state: RepositoryExplorerState,
  input: ImpactTargetInput
): RepositoryImpactTarget | null => {
  if (input.filePath) {
    const file = findFile(state, input.filePath);
    if (!file) return null;
    if (input.symbolName) {
      const symbol = findSymbolInFile(file.sourceFile, input.symbolName);
      if (!symbol) return null;
      return { type: "symbol", path: file.sourceFile.relativePath, symbol: symbol.name, kind: symbol.kind };
    }
    return { type: "file", path: file.sourceFile.relativePath };
  }

  if (input.symbolName) {
    const match = findSymbolMatches(state, normalize(input.symbolName))[0];
    if (!match) return null;
    return { type: "symbol", path: match.path, symbol: match.name, kind: match.kind };
  }

  return null;
}

function buildTransitiveFileImpact(
  state: RepositoryExplorerState,
  targetPath: string,
  visited: Set<string>
): RepositoryImpactItem[] {
  const result: RepositoryImpactItem[] = [];
  const queue: Array<{ path: string; distance: number }> = [{ path: targetPath, distance: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const related of relatedFiles(state, current.path)) {
      if (visited.has(related.path)) continue;
      visited.add(related.path);
      const distance = current.distance + 1;
      result.push({
        type: "file",
        path: related.path,
        distance: "indirect",
        relationship: related.relationship,
        reason: `${related.path} is transitively connected through ${current.path}.`,
      });
      queue.push({ path: related.path, distance });
    }
  }

  return result;
}

function relatedFiles(
  state: RepositoryExplorerState,
  targetPath: string
): Array<{ path: string; relationship: string }> {
  const related: Array<{ path: string; relationship: string }> = [];
  for (const workspace of state.workspaces) {
    const dependency = workspace.dependencyGraph.nodes.find(node => samePath(node.file, targetPath));
    const reverse = workspace.reverseDependencyGraph.nodes.find(node => samePath(node.file, targetPath));
    dependency?.imports.forEach(path => related.push({ path, relationship: "depends_on" }));
    reverse?.usedBy.forEach(path => related.push({ path, relationship: "used_by" }));
  }
  return related;
}

function calculateRisk(input: {
  directCount: number;
  indirectCount: number;
  callerCount: number;
  calleeCount: number;
  cycleCount: number;
  architectureCount: number;
}): RepositoryImpactRisk {
  const score = Math.min(100,
    input.directCount * 8 +
    input.indirectCount * 3 +
    (input.callerCount + input.calleeCount) * 5 +
    input.cycleCount * 20 +
    input.architectureCount * 5
  );
  const level: ImpactRiskLevel = score >= 55 ? "high" : score >= 25 ? "medium" : "low";
  const reasons: string[] = [];
  if (input.directCount > 0) reasons.push(`${input.directCount} direct impact item${input.directCount === 1 ? "" : "s"}.`);
  if (input.indirectCount > 0) reasons.push(`${input.indirectCount} indirect impact item${input.indirectCount === 1 ? "" : "s"}.`);
  if (input.callerCount > 0) reasons.push(`${input.callerCount} caller${input.callerCount === 1 ? "" : "s"}.`);
  if (input.calleeCount > 0) reasons.push(`${input.calleeCount} callee${input.calleeCount === 1 ? "" : "s"}.`);
  if (input.cycleCount > 0) reasons.push(`Participates in ${input.cycleCount} dependency cycle${input.cycleCount === 1 ? "" : "s"}.`);
  if (input.architectureCount > 0) reasons.push("Belongs to an indexed architectural workspace.");
  if (reasons.length === 0) reasons.push("No indexed dependents, calls, or transitive relationships were found.");
  return { level, score, reasons };
}

function symbolItem(
  state: RepositoryExplorerState,
  symbol: string,
  distance: "direct" | "indirect",
  reason: string
): RepositoryImpactItem {
  const match = findSymbolMatches(state, normalize(symbol))[0];
  return {
    type: "symbol",
    symbol,
    path: match?.path,
    kind: match?.kind,
    distance,
    relationship: "call_graph",
    reason,
  };
}

function findFile(state: RepositoryExplorerState, filePath: string) {
  for (const workspace of state.workspaces) {
    const sourceFile = workspace.sourceFiles.find(file => samePath(file.relativePath, filePath));
    if (sourceFile) return { workspace, sourceFile };
  }
  return null;
}

function findSymbolInFile(sourceFile: RepositoryExplorerState["workspaces"][number]["sourceFiles"][number], symbolName: string) {
  for (const [, symbol] of sourceFile.symbolTable) {
    if (normalize(symbol.name) === normalize(symbolName)) return symbol;
  }
  return null;
}

function findSymbolMatches(state: RepositoryExplorerState, symbolName: string): Array<{ name: string; path: string; kind: string }> {
  const matches: Array<{ name: string; path: string; kind: string }> = [];
  for (const workspace of state.workspaces) {
    for (const sourceFile of workspace.sourceFiles) {
      for (const [, symbol] of sourceFile.symbolTable) {
        if (normalize(symbol.name).includes(normalize(symbolName))) {
          matches.push({ name: symbol.name, path: sourceFile.relativePath, kind: symbol.kind });
        }
      }
    }
  }
  return matches;
}

function dedupeImpact(items: RepositoryImpactItem[]): RepositoryImpactItem[] {
  const byKey = new Map<string, RepositoryImpactItem>();
  for (const item of items) {
    const key = `${item.type}:${item.path ?? ""}:${item.symbol ?? ""}:${item.relationship ?? ""}`;
    const current = byKey.get(key);
    if (!current || (current.distance === "indirect" && item.distance === "direct")) byKey.set(key, item);
  }
  return [...byKey.values()];
}

function uniqueImpactCount(items: RepositoryImpactItem[]): number {
  return new Set(items.map(item => `${item.type}:${item.path ?? ""}:${item.symbol ?? ""}`)).size;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function samePath(left: string, right: string): boolean {
  return normalize(left) === normalize(right);
}

function normalize(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase().trim();
}
