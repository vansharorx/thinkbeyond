import type { RepositoryExplorerState } from "./repository-explorer-state.service";
import { loadRepositoryExplorerState } from "./repository-explorer-state.service";
import { analyzeImpact } from "../analysis/impact/impact-analysis.service";
import { AppError } from "../utils/AppError";
import type {
  SemanticGraph,
  SemanticGraphEdge,
  SemanticGraphNode,
  SemanticGraphNodeType,
  SemanticGraphOperation,
  SemanticGraphOverview,
  SemanticGraphPathResult,
  SemanticGraphQuery,
  SemanticGraphResponse,
  SemanticGraphRelationship,
} from "../types/repository-semantic-graph.types";

export const SEMANTIC_GRAPH_OPERATIONS: SemanticGraphOperation[] = [
  "overview",
  "neighbors",
  "path",
  "ancestors",
  "descendants",
  "related",
  "subgraph",
];

const DEFAULT_DEPTH = 2;
const MAX_DEPTH = 5;
const MAX_QUERY_NODES = 100;

export const getRepositorySemanticGraph = async (
  repositoryId: string,
  query: SemanticGraphQuery
): Promise<SemanticGraphResponse | null> => {
  const state = await loadRepositoryExplorerState(repositoryId);
  if (!state) return null;

  const graph = buildGraph(state);
  const operation = query.operation;
  if (operation === "overview") {
    return { repositoryId, operation, overview: buildOverview(state, graph) };
  }

  if (operation === "path") {
    const from = resolveNode(graph, query.from);
    const to = resolveNode(graph, query.to);
    if (!from || !to) throw new AppError("Graph node not found", 404);
    return {
      repositoryId,
      operation,
      path: findPath(graph, from.id, to.id),
    };
  }

  const target = resolveTarget(graph, query);
  if (!target) return { repositoryId, operation };

  if (operation === "neighbors") {
    const relationships = graph.edges.filter(edge => edge.source === target.id || edge.target === target.id);
    return {
      repositoryId,
      operation,
      node: target,
      neighbors: relatedNodes(graph, relationships, target.id),
      relationships,
    };
  }

  const depth = validateDepth(query.depth);
  const traversal = traverse(graph, target.id, operation === "ancestors" ? "ancestors" : operation === "descendants" ? "descendants" : "both", depth);
  if (operation === "subgraph") {
    return {
      repositoryId,
      operation,
      node: target,
      nodes: traversal.nodes,
      relationships: traversal.edges,
      depth,
    };
  }

  return {
    repositoryId,
    operation,
    node: target,
    nodes: traversal.nodes,
    relationships: traversal.edges,
    depth,
  };
};

export const buildGraph = (state: RepositoryExplorerState): SemanticGraph => {
  const nodes = new Map<string, SemanticGraphNode>();
  const edges = new Map<string, SemanticGraphEdge>();
  const repositoryId = graphRepositoryId(state.repositoryId);
  addNode(nodes, { id: repositoryId, type: "repository", label: state.repositoryId });

  for (const workspace of state.workspaces) {
    const workspaceId = graphWorkspaceId(workspace.name);
    addNode(nodes, { id: workspaceId, type: "workspace", label: workspace.name, workspace: workspace.name });
    addEdge(edges, repositoryId, workspaceId, "contains");
    const architectureId = `architecture:${workspace.name}:${workspace.architecture.architecture}`;
    addNode(nodes, {
      id: architectureId,
      type: "architecture",
      label: workspace.architecture.architecture,
      workspace: workspace.name,
      metadata: { patterns: workspace.architecture.patterns },
    });
    addEdge(edges, workspaceId, architectureId, "architecture_member");

    for (const sourceFile of workspace.sourceFiles) {
      const fileId = graphFileId(workspace.name, sourceFile.relativePath);
      addNode(nodes, {
        id: fileId,
        type: "file",
        label: sourceFile.relativePath,
        workspace: workspace.name,
        path: sourceFile.relativePath,
        metadata: { extension: sourceFile.extension, lines: sourceFile.lines, size: sourceFile.size },
      });
      addEdge(edges, workspaceId, fileId, "contains");
      addEdge(edges, fileId, workspaceId, "belongs_to");
      addEdge(edges, fileId, architectureId, "architecture_member");

      for (const symbol of sourceFile.symbolTable.values()) {
        const symbolId = graphSymbolId(workspace.name, sourceFile.relativePath, symbol.name, symbol.kind);
        addNode(nodes, {
          id: symbolId,
          type: "symbol",
          label: symbol.name,
          workspace: workspace.name,
          path: sourceFile.relativePath,
          symbol: symbol.name,
          kind: symbol.kind,
          metadata: { exported: symbol.exported, startLine: symbol.startLine, endLine: symbol.endLine },
        });
        addEdge(edges, fileId, symbolId, "defines");
        addEdge(edges, symbolId, fileId, "contains");
      }
    }

    for (const dependencyNode of workspace.dependencyGraph.nodes) {
      const source = graphFileId(workspace.name, dependencyNode.file);
      for (const dependency of dependencyNode.imports) {
        addEdge(edges, source, graphFileId(workspace.name, dependency), "depends_on");
      }
    }

    for (const reverseNode of workspace.reverseDependencyGraph.nodes) {
      const target = graphFileId(workspace.name, reverseNode.file);
      for (const user of reverseNode.usedBy) {
        addEdge(edges, graphFileId(workspace.name, user), target, "used_by");
      }
    }
  }

  for (const call of state.knowledge.callGraph.edges) {
    const callers = findSymbolNodes(nodes, call.caller);
    const callees = findSymbolNodes(nodes, call.callee);
    for (const caller of callers) {
      for (const callee of callees) addEdge(edges, caller.id, callee.id, "calls");
    }
  }

  for (const symbolNode of [...nodes.values()].filter(node => node.type === "symbol" && node.symbol)) {
    const impact = analyzeImpact(state.knowledge.callGraph, symbolNode.symbol!);
    for (const impactedName of impact.directImpact) {
      for (const impactedNode of findSymbolNodes(nodes, impactedName)) {
        addEdge(edges, symbolNode.id, impactedNode.id, "impacts");
      }
    }
  }

  return {
    repositoryId: state.repositoryId,
    nodes: [...nodes.values()].sort(compareNodes),
    edges: [...edges.values()].sort(compareEdges),
  };
};

function buildOverview(state: RepositoryExplorerState, graph: SemanticGraph): SemanticGraphOverview {
  const nodesByType = countBy(graph.nodes.map(node => node.type));
  const relationshipsByType = countBy(graph.edges.map(edge => edge.type));
  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    nodesByType,
    relationshipsByType,
    workspaceCount: state.workspaces.length,
    fileCount: nodesByType.file ?? 0,
    symbolCount: nodesByType.symbol ?? 0,
    cycleCount: state.workspaces.reduce((count, workspace) => count + workspace.circularDependencies.cycles.length, 0),
    architecture: state.workspaces.map(workspace => ({
      workspace: workspace.name,
      architecture: workspace.architecture.architecture,
      patterns: workspace.architecture.patterns,
    })),
  };
}

function resolveTarget(graph: SemanticGraph, query: SemanticGraphQuery): SemanticGraphNode | null {
  if (query.nodeId) return resolveNode(graph, query.nodeId);
  if (query.symbolName) {
    const matches = graph.nodes.filter(node => node.type === "symbol" && node.symbol?.toLowerCase() === query.symbolName?.toLowerCase() && (!query.filePath || samePath(node.path, query.filePath)));
    return matches.length === 1 ? matches[0] : null;
  }
  if (query.filePath) {
    const matches = graph.nodes.filter(node => node.type === "file" && samePath(node.path, query.filePath));
    return matches.length === 1 ? matches[0] : null;
  }
  return null;
}

function resolveNode(graph: SemanticGraph, nodeId?: string): SemanticGraphNode | null {
  if (!nodeId) return null;
  return graph.nodes.find(node => node.id === nodeId) ?? null;
}

function findPath(graph: SemanticGraph, fromId: string, toId: string): SemanticGraphPathResult {
  if (fromId === toId) {
    const node = resolveNode(graph, fromId);
    return node ? { found: true, path: [node], relationships: [], length: 1 } : emptyPath();
  }
  const outgoing = adjacency(graph, "outgoing");
  const queue: string[][] = [[fromId]];
  const visited = new Set<string>([fromId]);
  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];
    for (const edge of outgoing.get(current) ?? []) {
      if (visited.has(edge.target)) continue;
      const nextPath = [...path, edge.target];
      if (edge.target === toId) {
        return pathResult(graph, nextPath);
      }
      visited.add(edge.target);
      queue.push(nextPath);
    }
  }
  return emptyPath();
}

function traverse(graph: SemanticGraph, centerId: string, direction: "ancestors" | "descendants" | "both", depth: number): { nodes: SemanticGraphNode[]; edges: SemanticGraphEdge[] } {
  const adjacencyMap = adjacency(graph, direction === "ancestors" ? "incoming" : "outgoing");
  const reverseMap = direction === "both" ? adjacency(graph, "incoming") : new Map<string, SemanticGraphEdge[]>();
  const visited = new Set<string>([centerId]);
  const selectedEdges = new Map<string, SemanticGraphEdge>();
  const queue: Array<{ id: string; level: number }> = [{ id: centerId, level: 0 }];
  while (queue.length > 0 && visited.size < MAX_QUERY_NODES) {
    const current = queue.shift()!;
    if (current.level >= depth) continue;
    const edges = [...(adjacencyMap.get(current.id) ?? []), ...(reverseMap.get(current.id) ?? [])];
    for (const edge of edges) {
      if (visited.size >= MAX_QUERY_NODES) break;
      selectedEdges.set(edgeKey(edge), edge);
      const next = edge.source === current.id ? edge.target : edge.source;
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push({ id: next, level: current.level + 1 });
    }
  }
  const nodes = graph.nodes.filter(node => visited.has(node.id)).sort(compareNodes);
  return { nodes, edges: [...selectedEdges.values()].sort(compareEdges) };
}

function pathResult(graph: SemanticGraph, ids: string[]): SemanticGraphPathResult {
  const path = ids.map(id => resolveNode(graph, id)).filter((node): node is SemanticGraphNode => Boolean(node));
  const relationships = ids.slice(0, -1).map((id, index) => graph.edges.find(edge => edge.source === id && edge.target === ids[index + 1])).filter((edge): edge is SemanticGraphEdge => Boolean(edge));
  return { found: path.length === ids.length, path, relationships, length: path.length };
}

function emptyPath(): SemanticGraphPathResult {
  return { found: false, path: [], relationships: [], length: 0 };
}

function relatedNodes(graph: SemanticGraph, edges: SemanticGraphEdge[], targetId: string): SemanticGraphNode[] {
  const ids = new Set(edges.map(edge => edge.source === targetId ? edge.target : edge.source));
  return graph.nodes.filter(node => ids.has(node.id)).sort(compareNodes);
}

function findSymbolNodes(nodes: Map<string, SemanticGraphNode>, name: string): SemanticGraphNode[] {
  return [...nodes.values()].filter(node => node.type === "symbol" && node.symbol === name);
}

function addNode(nodes: Map<string, SemanticGraphNode>, node: SemanticGraphNode): void {
  if (!nodes.has(node.id)) nodes.set(node.id, node);
}

function addEdge(edges: Map<string, SemanticGraphEdge>, source: string, target: string, type: SemanticGraphRelationship): void {
  const key = `${source}|${target}|${type}`;
  if (!edges.has(key)) edges.set(key, { source, target, type });
}

function adjacency(graph: SemanticGraph, direction: "incoming" | "outgoing"): Map<string, SemanticGraphEdge[]> {
  const map = new Map<string, SemanticGraphEdge[]>();
  for (const edge of graph.edges) {
    const key = direction === "outgoing" ? edge.source : edge.target;
    const list = map.get(key) ?? [];
    list.push(edge);
    map.set(key, list);
  }
  return map;
}

function validateDepth(value?: number): number {
  if (value === undefined) return DEFAULT_DEPTH;
  if (!Number.isInteger(value) || value < 1 || value > MAX_DEPTH) throw new AppError(`depth must be an integer between 1 and ${MAX_DEPTH}`, 400);
  return value;
}

function graphRepositoryId(repositoryId: string): string { return `repository:${repositoryId}`; }
function graphWorkspaceId(workspace: string): string { return `workspace:${workspace}`; }
function graphFileId(workspace: string, path: string): string { return `file:${workspace}:${path}`; }
export function graphSymbolId(workspace: string, path: string, name: string, kind: string): string { return `symbol:${workspace}:${path}:${name}:${kind}`; }
function samePath(left: string | undefined, right: string | undefined): boolean { return Boolean(left && right && left.replace(/\\/g, "/").toLowerCase() === right.replace(/\\/g, "/").toLowerCase()); }
function edgeKey(edge: SemanticGraphEdge): string { return `${edge.source}|${edge.target}|${edge.type}`; }
function compareNodes(left: SemanticGraphNode, right: SemanticGraphNode): number { return left.id.localeCompare(right.id); }
function compareEdges(left: SemanticGraphEdge, right: SemanticGraphEdge): number { return edgeKey(left).localeCompare(edgeKey(right)); }
function countBy(values: string[]): Record<string, number> { return values.reduce<Record<string, number>>((counts, value) => { counts[value] = (counts[value] ?? 0) + 1; return counts; }, {}); }
