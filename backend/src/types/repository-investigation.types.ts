import type {
  RepositoryIntelligenceQuery,
  RepositoryIntelligenceResult,
  RepositoryQueryOperation,
} from "./repository-intelligence-query.types";

export const INVESTIGATION_OPERATIONS = [
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
  "change-plan",
  "health",
] as const;

export type InvestigationOperation = typeof INVESTIGATION_OPERATIONS[number];
export type InvestigationConfidence = "low" | "medium" | "high";
export type InvestigationStepStatus = "executed" | "skipped";

export interface RepositoryInvestigationRequest {
  query: string;
  operation?: InvestigationOperation;
  maxSteps?: number;
  maxResultsPerStep?: number;
  maxDepth?: number;
}

export interface InvestigationStepPlan {
  id: string;
  operation: RepositoryQueryOperation;
  reason: string;
  input: RepositoryIntelligenceQuery;
  priority: number;
}

export interface InvestigationStepResult {
  plan: InvestigationStepPlan;
  status: InvestigationStepStatus;
  result?: RepositoryIntelligenceResult;
  error?: string;
}

export type InvestigationFindingCategory =
  | "HIGH_CHANGE_RISK"
  | "HIGH_COUPLING"
  | "CIRCULAR_DEPENDENCY"
  | "LARGE_IMPACT"
  | "DEAD_CODE"
  | "COMPLEX_RELATIONSHIP"
  | "ARCHITECTURE_CONCERN"
  | "HIGH_DEPENDENCY_FANOUT"
  | "HIGH_DEPENDENT_FANOUT"
  | "AMBIGUOUS_SYMBOL"
  | "INSUFFICIENT_EVIDENCE";

export interface InvestigationFinding {
  id: string;
  type: InvestigationFindingCategory;
  severity: "low" | "medium" | "high";
  title: string;
  summary: string;
  confidence: InvestigationConfidence;
  sources: string[];
  relatedFiles: string[];
  relatedSymbols: string[];
  evidence: string[];
}

export interface InvestigationRecommendation {
  id: string;
  title: string;
  summary: string;
  findingIds: string[];
  confidence: InvestigationConfidence;
}

export interface InvestigationChangePlan {
  targetFiles: string[];
  targetSymbols: string[];
  dependencies: string[];
  dependents: string[];
  callers: string[];
  callees: string[];
  impactedFiles: string[];
  architecturalAreas: string[];
  risks: string[];
  validationAreas: string[];
}

export interface RepositoryInvestigationResult {
  success: true;
  repositoryId: string;
  query: string;
  intent: string;
  plan: InvestigationStepPlan[];
  steps: InvestigationStepResult[];
  findings: InvestigationFinding[];
  recommendations: InvestigationRecommendation[];
  sources: string[];
  confidence: InvestigationConfidence;
  stats: {
    stepsExecuted: number;
    resultsCollected: number;
    findingsGenerated: number;
  };
  changePlan?: InvestigationChangePlan;
}

export type InvestigationQueryOperation = RepositoryQueryOperation;
