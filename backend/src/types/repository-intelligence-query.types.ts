export const REPOSITORY_QUERY_OPERATIONS = [
  "search",
  "symbol",
  "dependencies",
  "dependents",
  "callers",
  "callees",
  "impact",
  "path",
  "neighbors",
  "related",
  "architecture",
  "metrics",
  "overview",
] as const;

export type RepositoryQueryOperation = typeof REPOSITORY_QUERY_OPERATIONS[number];

export interface RepositoryIntelligenceQuery {
  operation: RepositoryQueryOperation;
  query?: string;
  nodeId?: string;
  symbolName?: string;
  filePath?: string;
  from?: string;
  to?: string;
  depth?: number;
  limit?: number;
  kind?: "function" | "method" | "class" | "interface" | "enum" | "typeAlias" | "variable";
  workspace?: string;
}

export interface RepositoryQueryClassification {
  operation?: RepositoryQueryOperation;
  candidates: RepositoryQueryOperation[];
  confidence: "high" | "medium" | "ambiguous";
  reason: string;
}

export interface RepositoryIntelligenceResult {
  success: true;
  repositoryId: string;
  operation: RepositoryQueryOperation;
  target?: {
    query?: string;
    symbolName?: string;
    filePath?: string;
    from?: string;
    to?: string;
  };
  results: unknown[];
  relationships: unknown[];
  metadata: {
    count: number;
    source: string;
    limit: number;
    depth?: number;
    classification?: RepositoryQueryClassification;
  };
  details?: Record<string, unknown>;
}
