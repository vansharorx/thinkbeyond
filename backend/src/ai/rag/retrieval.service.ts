import type { RepositoryExplorerState } from "../../services/repository-explorer-state.service";
import { searchRepositoryExplorer } from "../../analysis/search/search.service";
import { analyzeImpact } from "../../analysis/impact/impact-analysis.service";
import { chunkText } from "./chunking.service";
import { rankChunks } from "./ranking.service";
import type { AiChunk, AiRetrievalResult } from "../ai.types";

export const retrieveRepositoryContext = (
  state: RepositoryExplorerState,
  query: string,
  limit = 8,
  intent?: string
): AiRetrievalResult => {
  const searchResults = searchRepositoryExplorer(state.workspaces, query, { scope: "all", matchMode: "partial" });
  const chunks: AiChunk[] = [];

  chunks.push(
    chunkText("repository", "Repository Summary", JSON.stringify({
      summary: state.summary,
      metrics: state.knowledge.metrics,
      health: state.knowledge.health,
    }, null, 2), { kind: "repository" }, structuralScore("repository", query, 10, intent))
  );

  for (const hit of searchResults.files) {
    const file = findFile(state, hit.path);
    if (!file) {
      continue;
    }

    chunks.push(chunkText(
      "file",
      file.relativePath,
      JSON.stringify({
        imports: file.imports,
        exports: file.exports,
        functions: file.ast?.functions ?? [],
        classes: file.ast?.classes ?? [],
        interfaces: file.ast?.interfaces ?? [],
        enums: file.ast?.enums ?? [],
        variables: file.ast?.variables ?? [],
        methods: file.ast?.methods ?? [],
        typeAliases: file.ast?.typeAliases ?? [],
        functionCalls: file.ast?.functionCalls ?? [],
        dependencies: getDependencies(state, file.relativePath),
      }, null, 2),
      { workspace: hit.workspace, path: file.relativePath },
      hit.score
    ));
  }

  for (const hit of searchResults.symbols) {
    chunks.push(chunkText(
      "symbol",
      `${hit.kind}: ${hit.name}`,
      JSON.stringify(hit, null, 2),
      { workspace: hit.workspace, path: hit.path, kind: hit.kind },
      hit.score
    ));
  }

  const graphChunks = state.knowledge.callGraph.edges.map(edge => chunkText(
    "callGraph",
    `${edge.caller} -> ${edge.callee}`,
    JSON.stringify(edge, null, 2),
    { caller: edge.caller, callee: edge.callee },
    structuralScore("callGraph", query, 3, intent)
  ));

  chunks.push(...graphChunks);

  const dependencyChunks = state.workspaces.flatMap(workspace =>
    workspace.dependencyGraph.nodes.map(node => chunkText(
      "dependencyGraph",
      node.file,
      JSON.stringify(node, null, 2),
      { workspace: workspace.name, file: node.file },
      structuralScore("dependencyGraph", query, node.imports.length + 2, intent)
    ))
  );

  chunks.push(...dependencyChunks);

  const reverseDependencyChunks = state.workspaces.flatMap(workspace =>
    workspace.reverseDependencyGraph.nodes.map(node => chunkText(
      "reverseDependency",
      node.file,
      JSON.stringify(node, null, 2),
      { workspace: workspace.name, file: node.file, usedBy: node.usedBy },
      structuralScore("reverseDependency", query, node.usedBy.length + 2, intent)
    ))
  );

  chunks.push(...reverseDependencyChunks);

  const circularDependencyChunks = state.workspaces.flatMap(workspace =>
    workspace.circularDependencies.cycles.map((cycle, index) => chunkText(
      "circularDependency",
      `${workspace.name} cycle ${index + 1}`,
      JSON.stringify(cycle, null, 2),
      { workspace: workspace.name, cycle: cycle.cycle },
      structuralScore("circularDependency", query, 4, intent)
    ))
  );

  chunks.push(...circularDependencyChunks);

  const deadCode = state.knowledge.deadCode;
  chunks.push(
    chunkText("deadCode", "Unused Functions", JSON.stringify(deadCode.unusedFunctions, null, 2), { category: "unusedFunctions" }, structuralScore("deadCode", query, 4, intent)),
    chunkText("deadCode", "Unused Exported Functions", JSON.stringify(deadCode.unusedExportedFunctions, null, 2), { category: "unusedExportedFunctions" }, structuralScore("deadCode", query, 4, intent)),
    chunkText("deadCode", "Unreachable Functions", JSON.stringify(deadCode.unreachableFunctions, null, 2), { category: "unreachableFunctions" }, structuralScore("deadCode", query, 4, intent))
  );

  const impactFunctions = new Set<string>();
  for (const edge of state.knowledge.callGraph.edges) {
    if (matchesQuery(`${edge.caller} ${edge.callee}`, query)) {
      impactFunctions.add(edge.caller);
      impactFunctions.add(edge.callee);
    }
  }
  for (const hit of searchResults.functions) {
    impactFunctions.add(hit.name);
  }

  for (const functionName of impactFunctions) {
    const impact = analyzeImpact(state.knowledge.callGraph, functionName);
    chunks.push(chunkText(
      "impact",
      functionName,
      JSON.stringify(impact, null, 2),
      { function: functionName },
      structuralScore("impact", query, 5, intent)
    ));
  }

  const knowledgeGraph = state.knowledge.knowledgeGraph;
  for (const node of knowledgeGraph.nodes) {
    chunks.push(chunkText(
      "knowledgeGraph",
      node.id,
      JSON.stringify(node, null, 2),
      { nodeId: node.id, nodeType: node.type, ...(node.meta ?? {}) },
      structuralScore("knowledgeGraph", query, 2, intent)
    ));
  }

  for (const edge of knowledgeGraph.edges) {
    chunks.push(chunkText(
      "knowledgeGraph",
      `${edge.from} ${edge.type} ${edge.to}`,
      JSON.stringify(edge, null, 2),
      { from: edge.from, to: edge.to, relationship: edge.type },
      structuralScore("knowledgeGraph", query, 2, intent)
    ));
  }

  for (const workspace of state.workspaces) {
    chunks.push(
      chunkText("architecture", workspace.name, JSON.stringify({
        architecture: workspace.architecture,
        manifest: workspace.manifest,
        packageAnalysis: workspace.packageAnalysis,
      }, null, 2), { workspace: workspace.name }, structuralScore("architecture", query, 4, intent))
    );
  }

  chunks.push(
    chunkText("metrics", "Repository Metrics", JSON.stringify(state.knowledge.metrics, null, 2), { metrics: true }, structuralScore("metrics", query, 5, intent)),
    chunkText("architecture", "Repository Health", JSON.stringify(state.knowledge.health, null, 2), { health: true }, structuralScore("architecture", query, 5, intent))
  );

  const ranked = rankChunks(chunks, query, limit);

  return {
    query,
    chunks: ranked,
  };
};

function findFile(state: RepositoryExplorerState, relativePath: string) {
  const normalized = normalize(relativePath);
  for (const workspace of state.workspaces) {
    const sourceFile = workspace.sourceFiles.find(file => normalize(file.relativePath) === normalized);
    if (sourceFile) {
      return sourceFile;
    }
  }

  return null;
}

function getDependencies(state: RepositoryExplorerState, relativePath: string): string[] {
  for (const workspace of state.workspaces) {
    const node = workspace.dependencyGraph.nodes.find(item => item.file === relativePath);
    if (node) {
      return node.imports;
    }
  }

  return [];
}

function normalize(value: string): string {
  return value.replace(/\\/g, "/").toLowerCase();
}

function matchesQuery(value: string, query: string): boolean {
  const normalizedQuery = normalize(query).trim();
  if (!normalizedQuery) return false;

  const normalizedValue = normalize(value);
  if (normalizedValue.includes(normalizedQuery)) return true;

  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .some(token => normalizedValue.includes(token));
}

function structuralScore(kind: string, query: string, base: number, intent?: string): number {
  const intentKinds: Record<string, string[]> = {
    dependency_question: ["dependencyGraph"],
    reverse_dependency_question: ["reverseDependency", "dependencyGraph"],
    call_flow_question: ["callGraph", "knowledgeGraph"],
    impact_question: ["impact", "callGraph", "reverseDependency"],
    dead_code_question: ["deadCode", "callGraph"],
    metrics_question: ["metrics", "architecture"],
    architecture_review: ["architecture", "metrics", "knowledgeGraph", "dependencyGraph"],
    repository_question: ["repository", "architecture", "metrics"],
  };

  if (intent === "impact_question") {
    if (kind === "impact") return base + 80;
    if (kind === "callGraph") return base + 50;
    if (kind === "reverseDependency") return base + 10;
  }

  return base + (intent && intentKinds[intent]?.includes(kind) ? 30 : 0);
}
