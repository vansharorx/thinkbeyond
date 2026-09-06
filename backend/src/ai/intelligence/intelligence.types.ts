import type { PromptTemplateName } from "../prompt/prompt-builder.service";
import type { AiRetrievalResult } from "../ai.types";
import type { AIResponse } from "../providers/provider.interface";
import type { AiContextBuilder } from "../context/context-builder.service";

export type IntelligenceIntent =
  | "repository_question"
  | "file_explanation"
  | "symbol_explanation"
  | "architecture_review"
  | "documentation"
  | "dependency_question"
  | "impact_question"
  | "dead_code_question"
  | "general_code_question";

export interface IntelligenceRequest {
  repositoryId: string;
  task: string;
  template: PromptTemplateName;
  filePath?: string;
  symbolName?: string;
  matchMode?: "exact" | "partial";
  intent?: IntelligenceIntent;
  mode?: string;
  context?: unknown;
}

export interface EvidenceItem {
  type: string;
  path?: string;
  symbol?: string;
  content: string;
  relationships?: Record<string, unknown>;
  relevanceScore: number;
  origin: string;
}

export interface IntelligenceMetadata {
  intent: IntelligenceIntent;
  provider: string;
  evidenceCount: number;
  contextCharacters: number;
}

export interface IntelligenceResult {
  answer: string;
  provider: string;
  evidence: EvidenceItem[];
  metadata: IntelligenceMetadata;
  context: unknown;
  structuredContext: AiContextBuilder;
  retrieval: AiRetrievalResult | null;
  response: AIResponse;
}