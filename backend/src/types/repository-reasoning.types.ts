import type { RepositoryIntelligenceQuery, RepositoryIntelligenceResult } from "./repository-intelligence-query.types";

export const REASONING_OPERATIONS = [
  "explain",
  "impact",
  "dependency-analysis",
  "architecture-analysis",
  "symbol-analysis",
  "relationship-analysis",
  "change-analysis",
  "repository-overview",
] as const;

export type ReasoningOperation = typeof REASONING_OPERATIONS[number];

export interface RepositoryReasoningRequest {
  operation: ReasoningOperation;
  query?: string;
  symbolName?: string;
  filePath?: string;
  from?: string;
  to?: string;
  depth?: number;
  limit?: number;
  maxQueries?: number;
  maxFindings?: number;
  maxEvidenceItems?: number;
}

export interface ReasoningPlan {
  operation: ReasoningOperation;
  queries: RepositoryIntelligenceQuery[];
}

export interface ReasoningEvidence {
  id: string;
  operation: RepositoryIntelligenceQuery["operation"];
  source: string;
  result: RepositoryIntelligenceResult;
}

export type ReasoningFindingType =
  | "dependency"
  | "impact"
  | "coupling"
  | "caller"
  | "callee"
  | "architecture"
  | "relationship"
  | "conflict";

export type ReasoningSeverity = "low" | "medium" | "high";

export interface ReasoningFinding {
  id: string;
  type: ReasoningFindingType;
  severity?: ReasoningSeverity;
  title: string;
  description: string;
  evidence: string[];
  sources: string[];
}

export interface ReasoningRelationship {
  source: string;
  target: string;
  relationship: "supports" | "overlaps" | "connects" | "conflicts";
  evidence: string[];
}

export interface RepositoryReasoningResult {
  success: true;
  repositoryId: string;
  operation: ReasoningOperation;
  target: {
    symbolName?: string;
    filePath?: string;
    from?: string;
    to?: string;
  };
  summary: string;
  plan: ReasoningPlan;
  findings: ReasoningFinding[];
  evidence: ReasoningEvidence[];
  relationships: ReasoningRelationship[];
  sources: string[];
  metadata: {
    queryCount: number;
    findingCount: number;
    evidenceCount: number;
    maxQueries: number;
    maxResultsPerQuery: number;
    maxFindings: number;
    maxEvidenceItems: number;
    depth: number;
  };
}
