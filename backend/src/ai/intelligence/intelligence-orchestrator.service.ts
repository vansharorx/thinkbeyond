import env from "../../config/env";
import { AppError } from "../../utils/AppError";
import { loadRepositoryExplorerState } from "../../services/repository-explorer-state.service";
import { buildAiContext } from "../context/context-builder.service";
import { retrieveRepositoryContext } from "../rag/retrieval.service";
import { runAiTask } from "../chat/ai-runner.service";
import { determineIntent } from "./intent.service";
import { boundedPromptValue, selectEvidence } from "./context-budget.service";
import { evidenceFromChunk, evidenceFromContext } from "./evidence.service";
import { buildImpactResponse, findImpactTarget, resolveImpactTarget } from "../../services/repository-impact.service";
import { getRepositoryDependencyIntelligence } from "../../services/repository-dependency.service";
import { getRepositorySymbolIntelligence } from "../../services/repository-symbol.service";
import { getRepositorySemanticGraph } from "../../services/repository-semantic-graph.service";
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
  const retrieval = retrieveRepositoryContext(state, retrievalQuery, 8, intent);
  const impactTargetInput = intent === "impact_question"
    ? (request.filePath || request.symbolName
      ? { filePath: request.filePath, symbolName: request.symbolName }
      : findImpactTarget(state, task))
    : null;
  const impactTarget = impactTargetInput ? resolveImpactTarget(state, impactTargetInput) : null;
  const impact = impactTarget ? buildImpactResponse(state, impactTarget) : null;
  const dependencyTarget = findDependencyEvidenceTarget(state, task, request.filePath);
  const dependencyIntelligence = dependencyTarget
    ? await getRepositoryDependencyIntelligence(request.repositoryId, {
      filePath: dependencyTarget,
      includeCycles: /cycle|circular/.test(task),
    })
    : null;
  const symbolEvidenceName = request.symbolName ?? findSymbolEvidenceName(state, task);
  const symbolIntelligence = symbolEvidenceName
    ? await getRepositorySymbolIntelligence(request.repositoryId, {
      symbolName: symbolEvidenceName,
      filePath: request.filePath,
      operation: /impact|affected|change|break/.test(task) ? "impact" : "overview",
    })
    : null;
  const graphTargetFile = request.filePath ?? findGraphFileEvidenceTarget(state, task);
  const semanticGraph = graphTargetFile || symbolEvidenceName
    ? await getRepositorySemanticGraph(request.repositoryId, {
      operation: "subgraph",
      symbolName: request.symbolName ?? undefined,
      filePath: graphTargetFile ?? undefined,
      depth: 2,
    })
    : null;
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
    ...(impact ? [evidenceFromContext("IMPACT", impact, {
      path: impact.target.path,
      symbol: impact.target.symbol,
      origin: "impact-analysis",
      score: 90,
      relationships: {
        risk: impact.risk,
        directImpact: impact.directImpact,
        indirectImpact: impact.indirectImpact,
        callers: impact.callers,
        callees: impact.callees,
        dependents: impact.dependents,
        dependencies: impact.dependencies,
      },
    })] : []),
    ...(dependencyIntelligence ? [evidenceFromContext("DEPENDENCY", dependencyIntelligence, {
      path: dependencyIntelligence.target.path,
      origin: "dependency-intelligence",
      score: 92,
      relationships: {
        dependencies: dependencyIntelligence.dependencies,
        dependents: dependencyIntelligence.dependents,
        chains: dependencyIntelligence.chains,
        cycles: dependencyIntelligence.cycles,
        connectivity: dependencyIntelligence.connectivity,
        architecture: dependencyIntelligence.architecture,
      },
    })] : []),
    ...(symbolIntelligence?.symbol ? [evidenceFromContext("SYMBOL", symbolIntelligence.symbol, {
      path: symbolIntelligence.symbol.filePath,
      symbol: symbolIntelligence.symbol.name,
      origin: "symbol-intelligence",
      score: 95,
      relationships: {
        callers: symbolIntelligence.symbol.callers,
        callees: symbolIntelligence.symbol.callees,
        dependencies: symbolIntelligence.symbol.dependencies,
        dependents: symbolIntelligence.symbol.dependents,
        relatedSymbols: symbolIntelligence.symbol.relatedSymbols,
        impact: symbolIntelligence.symbol.impact,
      },
    })] : []),
    ...(semanticGraph?.nodes ? [evidenceFromContext("SEMANTIC_GRAPH", {
      center: semanticGraph.node,
      nodes: semanticGraph.nodes,
      relationships: semanticGraph.relationships,
    }, {
      path: semanticGraph.node?.path,
      symbol: semanticGraph.node?.symbol,
      origin: "semantic-graph",
      score: 94,
      relationships: {
        depth: semanticGraph.depth,
        nodeCount: semanticGraph.nodes.length,
        edgeCount: semanticGraph.relationships?.length ?? 0,
      },
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

function findDependencyEvidenceTarget(
  state: Awaited<ReturnType<typeof loadRepositoryExplorerState>> extends infer T ? NonNullable<T> : never,
  task: string,
  filePath?: string
): string | null {
  if (filePath) {
    const file = state.workspaces.flatMap(workspace => workspace.sourceFiles).find(sourceFile => sourceFile.relativePath === filePath);
    if (file) return file.relativePath;
  }

  const normalized = task.toLowerCase();
  const candidates = state.workspaces.flatMap(workspace => workspace.sourceFiles.map(sourceFile => sourceFile.relativePath));
  for (const candidate of candidates) {
    if (normalized.includes(candidate.toLowerCase().replace(/\\/g, "/"))) {
      return candidate;
    }
  }

  const matches = state.workspaces
    .flatMap(workspace => workspace.sourceFiles)
    .filter(sourceFile => sourceFile.relativePath.toLowerCase().includes(normalized.replace(/[^a-z0-9/._-]+/g, " ").split(/\s+/).filter(Boolean).join(" ").toLowerCase().split(" ").find(Boolean) ?? ""))
    .map(sourceFile => sourceFile.relativePath);

  return matches[0] ?? null;
}

function findSymbolEvidenceName(
  state: Awaited<ReturnType<typeof loadRepositoryExplorerState>> extends infer T ? NonNullable<T> : never,
  task: string
): string | null {
  const normalized = task.toLowerCase();
  const symbols = state.workspaces.flatMap(workspace => workspace.sourceFiles.flatMap(file => [...file.symbolTable.values()]));
  return symbols
    .filter(symbol => normalized.includes(symbol.name.toLowerCase()))
    .sort((left, right) => right.name.length - left.name.length)[0]?.name ?? null;
}

function findGraphFileEvidenceTarget(
  state: Awaited<ReturnType<typeof loadRepositoryExplorerState>> extends infer T ? NonNullable<T> : never,
  task: string
): string | null {
  const normalized = task.toLowerCase();
  return state.workspaces
    .flatMap(workspace => workspace.sourceFiles)
    .map(sourceFile => sourceFile.relativePath)
    .find(filePath => normalized.includes(filePath.toLowerCase())) ?? null;
}

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
      .filter(item => item.origin === "repository-rag" || item.origin === "impact-analysis" || item.origin === "dependency-intelligence" || item.origin === "symbol-intelligence" || item.origin === "semantic-graph")
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