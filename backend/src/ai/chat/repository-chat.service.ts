import { AppError } from "../../utils/AppError";
import type { AiRetrievalResult } from "../ai.types";
import { runRepositoryIntelligence } from "../intelligence/intelligence-orchestrator.service";
import type { EvidenceItem, IntelligenceMetadata } from "../intelligence/intelligence.types";

export interface RepositoryChatResponse {
  repositoryId: string;
  question: string;
  provider: string;
  answer: string;
  context: unknown;
  retrieval: AiRetrievalResult;
  evidence: EvidenceItem[];
  metadata: IntelligenceMetadata;
}

export const chatRepository = async (
  repositoryId: string,
  question: string
): Promise<RepositoryChatResponse | null> => {
  const intelligence = await runRepositoryIntelligence({
    repositoryId,
    task: question,
    template: "explainRepository",
  });
  if (!intelligence) return null;
  if (!intelligence.retrieval) {
    throw new AppError("Repository retrieval is unavailable", 502);
  }

  return {
    repositoryId,
    question,
    provider: intelligence.provider,
    answer: intelligence.answer,
    context: intelligence.context,
    retrieval: intelligence.retrieval,
    evidence: intelligence.evidence,
    metadata: intelligence.metadata,
  };
};
