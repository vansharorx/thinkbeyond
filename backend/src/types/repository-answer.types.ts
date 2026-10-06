import type { RepositoryReasoningResult } from "./repository-reasoning.types";

export type RepositoryAnswerOperation =
  | "explain"
  | "impact"
  | "dependency-analysis"
  | "architecture-analysis"
  | "symbol-analysis"
  | "relationship-analysis"
  | "change-analysis"
  | "repository-overview";

export interface RepositoryAnswerRequest {
  question: string;
  operation?: RepositoryAnswerOperation | "answer";
}

export interface GroundedClaim {
  claim: string;
  supportedBy: string[];
}

export interface GroundedEvidenceRecord {
  id: string;
  kind: string;
  operation: string;
  source: string;
  summary: string;
  content: string;
  priority: number;
  provenance: string[];
}

export interface GroundedEvidencePacket {
  question: string;
  operation: RepositoryAnswerOperation | string;
  target: RepositoryReasoningResult["target"];
  findings: Array<{ id: string; type: string; title: string; description: string; sources: string[] }>;
  evidence: GroundedEvidenceRecord[];
  relationships: RepositoryReasoningResult["relationships"];
  sources: string[];
  constraints: string[];
  unsupportedClaims: string[];
  claimGrounding: GroundedClaim[];
}

export interface RepositoryAnswerResult {
  answer: string;
  grounded: boolean;
  operation: RepositoryAnswerOperation | string;
  sources: string[];
  findings: string[];
  evidenceCount: number;
  provider: string;
  model?: string;
  metadata: {
    reasoningUsed: boolean;
    provider: string;
    model?: string;
    sourceCount: number;
    evidenceSufficient: boolean;
    providerState: "llm" | "offline" | "not-used";
    operation: RepositoryAnswerOperation | string;
  };
  grounding: {
    unsupportedClaims: string[];
    claims: GroundedClaim[];
    conflicts: string[];
    ambiguous: boolean;
    evidenceSufficient: boolean;
  };
  context: unknown;
  retrieval: {
    query: string;
    chunks: Array<{ id: string; kind: string; title: string; content: string; score: number; metadata: Record<string, unknown> }>;
  };
  evidence: GroundedEvidenceRecord[];
}
