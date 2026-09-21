export type SemanticGraphNodeType =
  | "repository"
  | "workspace"
  | "file"
  | "symbol"
  | "architecture";

export type SemanticGraphRelationship =
  | "contains"
  | "defines"
  | "belongs_to"
  | "depends_on"
  | "used_by"
  | "calls"
  | "architecture_member"
  | "impacts"
  | "related_to";

export interface SemanticGraphNode {
  id: string;
  type: SemanticGraphNodeType;
  label: string;
  workspace?: string;
  path?: string;
  symbol?: string;
  kind?: string;
  metadata?: Record<string, unknown>;
}

export interface SemanticGraphEdge {
  source: string;
  target: string;
  type: SemanticGraphRelationship;
  metadata?: Record<string, unknown>;
}

export interface SemanticGraph {
  repositoryId: string;
  nodes: SemanticGraphNode[];
  edges: SemanticGraphEdge[];
}

export type SemanticGraphOperation =
  | "overview"
  | "neighbors"
  | "path"
  | "ancestors"
  | "descendants"
  | "related"
  | "subgraph";

export interface SemanticGraphQuery {
  operation: SemanticGraphOperation;
  nodeId?: string;
  symbolName?: string;
  filePath?: string;
  from?: string;
  to?: string;
  depth?: number;
}

export interface SemanticGraphOverview {
  nodeCount: number;
  edgeCount: number;
  nodesByType: Record<string, number>;
  relationshipsByType: Record<string, number>;
  workspaceCount: number;
  fileCount: number;
  symbolCount: number;
  cycleCount: number;
  architecture: Array<{ workspace: string; architecture: string; patterns: string[] }>;
}

export interface SemanticGraphPathResult {
  found: boolean;
  path: SemanticGraphNode[];
  relationships: SemanticGraphEdge[];
  length: number;
}

export interface SemanticGraphNeighborhoodResult {
  node: SemanticGraphNode;
  neighbors: SemanticGraphNode[];
  relationships: SemanticGraphEdge[];
}

export interface SemanticGraphSubgraphResult {
  center: SemanticGraphNode;
  nodes: SemanticGraphNode[];
  relationships: SemanticGraphEdge[];
  depth: number;
}

export interface SemanticGraphResponse {
  repositoryId: string;
  operation: SemanticGraphOperation;
  overview?: SemanticGraphOverview;
  node?: SemanticGraphNode;
  neighbors?: SemanticGraphNode[];
  relationships?: SemanticGraphEdge[];
  path?: SemanticGraphPathResult;
  nodes?: SemanticGraphNode[];
  depth?: number;
}
