import env from "../../config/env";
import { AppError } from "../../utils/AppError";
import { loadRepositoryExplorerState } from "../../services/repository-explorer-state.service";
import { buildAiContext } from "../context/context-builder.service";
import { retrieveRepositoryContext } from "../rag/retrieval.service";
import { runAiTask } from "../chat/ai-runner.service";
import { determineIntent } from "./intent.service";
import { boundedPromptValue, selectEvidence } from "./context-budget.service";
import { evidenceFromChunk, evidenceFromContext } from "./evidence.service";
import type { AiRetrievalResult } from "../ai.types";
import type { IntelligenceRequest, IntelligenceResult } from "./intelligence.types";

export const runRepositoryIntelligence = async (
  request: IntelligenceRequest
): Promise<IntelligenceResult | null> => {
  const task = request.task.trim();
  if (request.template === "explainRepository" && !task) {
    throw new AppError("Question is required", 400);
  }

  const state = await loadRepositoryExplorerState(request.repositoryId);
  if (!state) return null;

  const targetContext = await buildAiContext(
    state,
    request.filePath,
    request.symbolName,
    request.matchMode ?? "exact"
  );
  if (request.filePath && !targetContext.file) return null;
  if (request.symbolName && !targetContext.symbol) return null;

  const intent = determineIntent({ ...request, task });
  const retrievalQuery = task || request.filePath || request.symbolName || intent;
  const retrieval = retrieveRepositoryContext(state, retrievalQuery);
  const rawEvidence = [
    ...(targetContext.file ? [evidenceFromContext("FILE", targetContext.file, {
      path: targetContext.file.path,
      origin: "file-context",
      relationships: targetContext.file.callGraph,
    })] : []),
    ...(targetContext.symbol ? [evidenceFromContext("SYMBOL", targetContext.symbol, {
      path: targetContext.symbol.file,
      symbol: targetContext.symbol.name,
      origin: "symbol-context",
      relationships: { callers: targetContext.symbol.callers, callees: targetContext.symbol.callees },
    })] : []),
    ...retrieval.chunks.map(evidenceFromChunk),
  ].sort((left, right) => right.relevanceScore - left.relevanceScore);

  const evidence = selectEvidence(rawEvidence, {
    maxCharacters: env.AI_CONTEXT_MAX_CHARS,
    maxEvidenceItems: env.AI_EVIDENCE_LIMIT,
    maxItemCharacters: Math.max(1000, Math.floor(env.AI_CONTEXT_MAX_CHARS / env.AI_EVIDENCE_LIMIT)),
  });
  if (evidence.length === 0) throw new AppError("No relevant repository evidence found", 422);

  const context = buildPromptContext(request, targetContext, retrieval, evidence);
  const run = await runAiTask(request.template, context, task || undefined);
  const response = {
    provider: run.provider,
    model: run.model,
    content: run.content,
    usage: run.usage,
  };

  return {
    answer: run.content,
    provider: run.provider,
    evidence,
    metadata: {
      intent,
      provider: run.provider,
      evidenceCount: evidence.length,
      contextCharacters: JSON.stringify(context).length,
    },
    context,
    structuredContext: targetContext,
    retrieval,
    response,
  };
};

function buildPromptContext(
  request: IntelligenceRequest,
  targetContext: Awaited<ReturnType<typeof buildAiContext>>,
  retrieval: AiRetrievalResult,
  evidence: ReturnType<typeof selectEvidence>
): unknown {
  const budget = env.AI_CONTEXT_MAX_CHARS;
  const boundedRepository = boundedPromptValue(targetContext.repository, Math.floor(budget * 0.42));
  const retrievalItemLimit = Math.max(
    1000,
    Math.floor((budget * 0.42) / Math.max(1, evidence.length))
  );
  const boundedRetrieval = {
    query: retrieval.query,
    chunks: evidence
      .filter(item => item.origin === "repository-rag")
      .map(item => ({
        id: `${item.type}:${item.path ?? item.symbol ?? item.origin}`,
        kind: item.type,
        title: item.path ?? item.symbol ?? item.type,
        content: item.content.slice(0, retrievalItemLimit),
        score: item.relevanceScore,
        metadata: item.relationships ?? {},
      })),
  };

  switch (request.template) {
    case "explainRepository":
      return { repository: boundedRepository, retrieval: boundedRetrieval };
    case "explainFile":
      return boundedPromptValue(targetContext.file, Math.floor(budget * 0.9));
    case "explainSymbol":
      return boundedPromptValue(targetContext.symbol, Math.floor(budget * 0.9));
    case "generateDocumentation":
      return boundedPromptValue(request.context ?? { repository: boundedRepository, evidence }, budget);
    default:
      return boundedRepository;
  }
}