import env from "../config/env";
import { AppError } from "../utils/AppError";
import { createAIProvider } from "../ai/providers/provider-factory.service";
import { buildPrompt } from "../ai/prompt/prompt-builder.service";
import { determineIntent } from "../ai/intelligence/intent.service";
import { selectEvidence } from "../ai/intelligence/context-budget.service";
import { evidenceFromContext } from "../ai/intelligence/evidence.service";
import { executeRepositoryReasoning } from "./repository-reasoning.service";
import { executeRepositoryIntelligenceQuery, classifyRepositoryQuery } from "./repository-intelligence-query.service";
import { executeRepositoryInvestigation } from "./repository-investigation.service";
import type { RepositoryAnswerRequest, RepositoryAnswerResult, GroundedEvidencePacket, GroundedEvidenceRecord, GroundedClaim } from "../types/repository-answer.types";
import type { RepositoryReasoningResult } from "../types/repository-reasoning.types";
import type { RepositoryIntelligenceResult } from "../types/repository-intelligence-query.types";
import type { RepositoryInvestigationResult } from "../types/repository-investigation.types";

const DEFAULT_ANSWER_MODE = "answer";
const VALID_OPERATIONS = new Set([
  "answer",
  "explain",
  "impact",
  "dependency-analysis",
  "architecture-analysis",
  "symbol-analysis",
  "relationship-analysis",
  "change-analysis",
  "repository-overview",
]);

export const buildRepositoryAnswer = async (
  repositoryId: string,
  request: RepositoryAnswerRequest
): Promise<RepositoryAnswerResult> => {
  const question = request.question?.trim() ?? "";
  if (!question) throw new AppError("question is required", 400);
  if (question.length > 4000) throw new AppError("question is too long", 400);

  const operation = normalizeOperation(request.operation ?? DEFAULT_ANSWER_MODE);
  const intent = determineIntent({
    repositoryId,
    task: question,
    template: "explainRepository",
  });

  const reasoningOperation = resolveReasoningOperation(operation, question, intent);
  const reasoningRequest = reasoningOperation ? buildReasoningRequest(reasoningOperation, question) : null;
  const reasoning = reasoningRequest
    ? await executeRepositoryReasoning(repositoryId, reasoningRequest).catch(() => null)
    : null;

  const query = buildQueryFromQuestion(question, reasoningOperation);
  const queryResult = query
    ? await executeRepositoryIntelligenceQuery(repositoryId, query, classifyRepositoryQuery(question)).catch(() => null)
    : null;
  const investigation = shouldInvestigate(question)
    ? await executeRepositoryInvestigation(repositoryId, { query: question }).catch(() => null)
    : null;

  const packet = buildGroundedEvidencePacket(question, reasoningOperation ?? operation, reasoning, queryResult, investigation);
  const grounding = assessGrounding(packet);
  if (!grounding.evidenceSufficient || grounding.ambiguous) {
    const note = grounding.ambiguous
      ? "Multiple repository symbols match this request. Provide a file path or other disambiguating context before asking for an explanation."
      : "The repository evidence is insufficient to explain the requested symbol or file.";
    return offlineAnswerResult(question, operation, packet, note, grounding);
  }

  const selectedEvidence = selectEvidence(packet.evidence.map(item => ({
    type: item.kind,
    path: item.provenance[0],
    symbol: item.provenance.find(value => !value.includes("/")) ?? undefined,
    content: item.content,
    relationships: { source: item.source, operation: item.operation },
    relevanceScore: item.priority,
    origin: item.source,
  })), {
    maxCharacters: env.AI_CONTEXT_MAX_CHARS,
    maxEvidenceItems: env.AI_EVIDENCE_LIMIT,
    maxItemCharacters: Math.max(800, Math.floor(env.AI_CONTEXT_MAX_CHARS / env.AI_EVIDENCE_LIMIT)),
  });

  const provider = createAIProvider();
  const prompt = buildGroundedPrompt(question, packet, selectedEvidence);
  const response = await provider.generate(prompt, { timeoutMs: env.AI_TIMEOUT_MS });

  return {
    answer: response.content,
    grounded: true,
    operation: packet.operation,
    sources: packet.sources,
    findings: packet.findings.map(item => item.title),
    evidenceCount: selectedEvidence.length,
    provider: response.provider || provider.name,
    model: response.model,
    metadata: {
      reasoningUsed: Boolean(reasoning),
      provider: response.provider || provider.name,
      model: response.model,
      sourceCount: packet.sources.length,
      evidenceSufficient: grounding.evidenceSufficient,
      providerState: provider.name === "offline" ? "offline" : "llm",
      operation: packet.operation,
    },
    grounding: {
      unsupportedClaims: packet.unsupportedClaims,
      claims: packet.claimGrounding,
      conflicts: packet.relationships.filter(item => item.relationship === "conflicts").map(item => `${item.source} conflicts with ${item.target}`),
      ambiguous: grounding.ambiguous,
      evidenceSufficient: grounding.evidenceSufficient,
    },
    context: {
      operation: packet.operation,
      target: packet.target,
      evidence: packet.evidence,
      constraints: packet.constraints,
    },
    retrieval: {
      query: question,
      chunks: selectedEvidence.map(item => ({
        id: item.type,
        kind: item.type,
        title: item.path ?? item.symbol ?? item.origin,
        content: item.content,
        score: item.relevanceScore,
        metadata: { source: item.origin, operation: item.type },
      })),
    },
    evidence: packet.evidence,
  };
};

function normalizeOperation(value: string | undefined): string {
  const operation = (value ?? DEFAULT_ANSWER_MODE).trim();
  if (!VALID_OPERATIONS.has(operation)) {
    throw new AppError("Invalid operation", 400);
  }
  return operation;
}

function resolveReasoningOperation(operation: string, question: string, intent: string): string | null {
  const normalized = question.toLowerCase();
  if (operation === "answer") {
    if (/what happens if|what would break|change .*|impact|affected/.test(normalized)) return "change-analysis";
    if (/depends|dependency|used by|dependents/.test(normalized)) return "dependency-analysis";
    if (/architecture|repository structure|module layout/.test(normalized)) return "architecture-analysis";
    if (/explain|describe|what is .*|who is/.test(normalized)) return "explain";
    if (/relationship|related|connected|path between/.test(normalized)) return "relationship-analysis";
    if (/overview|summary|repository/.test(normalized)) return "repository-overview";
    return intent === "impact_question" ? "change-analysis" : intent === "dependency_question" || intent === "reverse_dependency_question" ? "dependency-analysis" : "repository-overview";
  }
  return operation;
}

function buildReasoningRequest(operation: string, question: string): Parameters<typeof executeRepositoryReasoning>[1] {
  const target = inferTargetFromQuestion(question);

  if (operation === "change-analysis") return {
    operation: "change-analysis",
    query: question,
    filePath: target.filePath,
    symbolName: target.symbolName,
    depth: 2,
  };
  if (operation === "dependency-analysis") return {
    operation: "dependency-analysis",
    query: question,
    filePath: target.filePath,
    symbolName: target.symbolName,
    depth: 2,
  };
  if (operation === "architecture-analysis") return { operation: "architecture-analysis", query: question, depth: 2 };
  if (operation === "relationship-analysis") return {
    operation: "relationship-analysis",
    query: question,
    symbolName: target.symbolName,
    filePath: target.filePath,
    depth: 2,
  };
  if (operation === "repository-overview") return { operation: "repository-overview", query: question, depth: 2 };
  return {
    operation: "explain",
    query: question,
    symbolName: target.symbolName,
    filePath: target.filePath,
    depth: 2,
  };
}

function inferTargetFromQuestion(question: string): { filePath?: string; symbolName?: string } {
  const trimmed = question.trim();
  const fileMatch = trimmed.match(/(?:^|\s)([A-Za-z0-9_./\\-]+\.[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)?)\b/);
  if (fileMatch) {
    const value = fileMatch[1].replace(/\\/g, "/");
    if (value.includes("/") || /\.(ts|tsx|js|jsx|md|json|yml|yaml)$/i.test(value)) {
      return { filePath: value };
    }
  }

  const symbolCandidates = [...trimmed.matchAll(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g)].map(match => match[0]);
  const symbol = symbolCandidates
    .filter(candidate => !/^(what|when|where|why|how|this|that|the|and|or|if|for|of|to|on|in|is|are|an|a|with|from|using|summarize|explain|repository|code|style|company|use)$/i.test(candidate))
    .sort((left, right) => right.length - left.length)[0];

  return symbol ? { symbolName: symbol } : {};
}

function buildQueryFromQuestion(question: string, operation: string | null): Parameters<typeof executeRepositoryIntelligenceQuery>[1] | null {
  if (!operation) return null;
  const normalized = question.trim();
  if (!normalized) return null;
  const queryOperation = classifyRepositoryQuery(normalized).operation;
  if (queryOperation === "search") return { operation: "search", query: normalized, limit: 10 };
  if (queryOperation === "impact") return { operation: "impact", query: normalized, limit: 10 };
  if (queryOperation === "dependencies") return { operation: "dependencies", query: normalized, limit: 10 };
  if (queryOperation === "callers" || queryOperation === "callees") return { operation: queryOperation, query: normalized, limit: 10 };
  if (queryOperation === "symbol") return { operation: "symbol", query: normalized, limit: 10 };
  return { operation: "overview", query: normalized, limit: 10 };
}

function shouldInvestigate(question: string): boolean {
  return /what happens if|what could break|risky|risk|what should i inspect|how does .* work|authentication|connected|architecture concern|biggest architecture|dependents|what depends|callers|callees|impact/.test(question.toLowerCase());
}

function offlineAnswerResult(
  question: string,
  operation: string,
  packet: GroundedEvidencePacket,
  note: string,
  grounding = assessGrounding(packet)
): RepositoryAnswerResult {
  const provider = createAIProvider();
  return {
    answer: `${note}\n\nQuestion: ${question}\n\nOperation: ${operation}`,
    grounded: false,
    operation,
    sources: packet.sources,
    findings: packet.findings.map(item => item.title),
    evidenceCount: packet.evidence.length,
    provider: provider.name,
    model: undefined,
    metadata: {
      reasoningUsed: false,
      provider: provider.name,
      model: undefined,
      sourceCount: packet.sources.length,
      evidenceSufficient: false,
      providerState: provider.name === "offline" ? "offline" : "not-used",
      operation,
    },
    grounding: {
      unsupportedClaims: packet.unsupportedClaims,
      claims: packet.claimGrounding,
      conflicts: packet.relationships.filter(item => item.relationship === "conflicts").map(item => `${item.source} conflicts with ${item.target}`),
      ambiguous: grounding.ambiguous,
      evidenceSufficient: grounding.evidenceSufficient,
    },
    context: { operation, target: packet.target, evidence: packet.evidence, note },
    retrieval: { query: question, chunks: [] },
    evidence: packet.evidence,
  };
}

function assessGrounding(packet: GroundedEvidencePacket): { ambiguous: boolean; evidenceSufficient: boolean } {
  const ambiguous = packet.evidence.some(hasAmbiguousEvidence);
  const evidenceSufficient = !ambiguous && packet.evidence.some(hasUsefulEvidence);
  return { ambiguous, evidenceSufficient };
}

function hasAmbiguousEvidence(item: GroundedEvidenceRecord): boolean {
  const payload = parseEvidence(item.content);
  if (!payload || typeof payload !== "object") return false;
  const details = (payload as { details?: unknown }).details;
  if (!details || typeof details !== "object") return false;
  const symbol = (details as { symbol?: unknown }).symbol;
  return Boolean(symbol && typeof symbol === "object" && "ambiguous" in symbol);
}

function hasUsefulEvidence(item: GroundedEvidenceRecord): boolean {
  const payload = parseEvidence(item.content);
  if (!payload || typeof payload !== "object") return false;
  const result = payload as { results?: unknown; relationships?: unknown };
  return (Array.isArray(result.results) && result.results.length > 0)
    || (Array.isArray(result.relationships) && result.relationships.length > 0);
}

function parseEvidence(content: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(content);
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function buildGroundedEvidencePacket(
  question: string,
  operation: string,
  reasoning: RepositoryReasoningResult | null,
  queryResult: RepositoryIntelligenceResult | null,
  investigation: RepositoryInvestigationResult | null
): GroundedEvidencePacket {
  const findings = reasoning?.findings ?? [];
  const evidence: GroundedEvidenceRecord[] = [];
  const relationships = reasoning?.relationships ?? [];
  const sources = reasoning?.sources ?? [];
  const packetFindings: GroundedEvidencePacket["findings"] = [
    ...findings.map(item => ({
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description,
      sources: item.sources,
    })),
    ...(investigation?.findings.map(item => ({
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.summary,
      sources: item.sources,
    })) ?? []),
  ];

  if (investigation) {
    evidence.push({
      id: `investigation:${investigation.query}`,
      kind: "INVESTIGATION",
      operation: investigation.intent,
      source: "repository-investigation",
      summary: `${investigation.stats.stepsExecuted} investigation step(s) produced ${investigation.findings.length} finding(s).`,
      content: JSON.stringify(investigation, null, 2),
      priority: 100,
      provenance: ["repository-investigation", investigation.intent],
    });
  }

  if (reasoning) {
    for (const item of reasoning.evidence) {
      evidence.push({
        id: item.id,
        kind: item.operation,
        operation: item.operation,
        source: item.source,
        summary: item.result.metadata.source,
        content: JSON.stringify(item.result, null, 2),
        priority: sourcePriority(item.source),
        provenance: [item.source, item.operation],
      });
    }
  }

  if (queryResult && !reasoning) {
    evidence.push({
      id: `query:${queryResult.operation}`,
      kind: queryResult.operation,
      operation: queryResult.operation,
      source: queryResult.metadata.source,
      summary: queryResult.operation,
      content: JSON.stringify(queryResult, null, 2),
      priority: sourcePriority(queryResult.metadata.source),
      provenance: [queryResult.metadata.source, queryResult.operation],
    });
  }

  const claimGrounding: GroundedClaim[] = findings.length > 0
    ? findings.map(item => ({
      claim: item.title,
      supportedBy: item.sources,
    }))
    : [{ claim: "The repository does not currently provide sufficient evidence for a confident conclusion.", supportedBy: ["repository-reasoning", "intelligence-query"] }];

  return {
    question,
    operation,
    target: reasoning?.target ?? { symbolName: undefined, filePath: undefined, from: undefined, to: undefined },
    findings: packetFindings,
    evidence: evidence,
    relationships: relationships,
    sources: Array.from(new Set([...sources, ...evidence.map(item => item.source)])),
    constraints: [
      "Use repository evidence as the factual source.",
      "Do not invent files, symbols, dependencies, callers, or architecture.",
      "State uncertainty when evidence is insufficient.",
      "Preserve conflicts and ambiguity.",
    ],
    unsupportedClaims: [
      "general programming advice",
      "assumed architecture that is not in the evidence",
      "unverified relationships",
    ],
    claimGrounding,
  };
}

function buildGroundedPrompt(question: string, packet: GroundedEvidencePacket, evidence: ReturnType<typeof selectEvidence>): string {
  const evidenceBlock = evidence.length > 0
    ? evidence.map(item => `- [${item.origin}] ${item.type}: ${item.content.slice(0, 800)}`).join("\n")
    : "- No repository evidence available.";

  return `You are a repository intelligence assistant.

GROUNDING RULES:
1. Use the supplied repository evidence as the factual source.
2. Do not invent files, symbols, dependencies, callers, architecture, or line numbers.
3. Do not claim something exists unless supported by evidence.
4. Distinguish repository facts from interpretation.
5. If evidence is insufficient, explicitly say so.
6. Preserve uncertainty, conflict, and ambiguity.
7. Do not fabricate code snippets or metrics.
8. General programming knowledge is not repository evidence.

QUESTION:
${question}

OPERATION:
${packet.operation}

CONSTRAINTS:
${packet.constraints.join("\n")}

CLAIMS TO GROUND:
${packet.claimGrounding.map(item => `- ${item.claim} -> ${item.supportedBy.join(", ")}`).join("\n")}

RELEVANT EVIDENCE:
${evidenceBlock}

Provide a concise repository-grounded answer. If evidence is missing or conflict exists, say so explicitly. Use a brief answer structure with Answer, Evidence, and Sources sections where useful.`;
}

function sourcePriority(source: string): number {
  const order = [
    "repository-reasoning",
    "intelligence-query",
    "symbol-intelligence",
    "impact-analysis",
    "dependency-intelligence",
    "semantic-graph",
    "architecture",
    "metrics",
    "repository-overview",
    "repository-rag",
  ];
  return order.indexOf(source) >= 0 ? (order.length - order.indexOf(source)) : 1;
}
