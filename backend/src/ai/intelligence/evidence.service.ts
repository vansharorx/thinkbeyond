import type { AiChunk } from "../ai.types";
import type { EvidenceItem } from "./intelligence.types";

export const evidenceFromChunk = (chunk: AiChunk): EvidenceItem => ({
  type: normalizeType(chunk.kind),
  path: getPath(chunk),
  symbol: getSymbol(chunk),
  content: chunk.content,
  relationships: chunk.metadata,
  relevanceScore: chunk.score,
  origin: "repository-rag",
});

export const evidenceFromContext = (
  type: string,
  content: unknown,
  options: { path?: string; symbol?: string; score?: number; origin?: string; relationships?: Record<string, unknown> } = {}
): EvidenceItem => ({
  type,
  path: options.path,
  symbol: options.symbol,
  content: JSON.stringify(content, null, 2),
  relationships: options.relationships,
  relevanceScore: options.score ?? 20,
  origin: options.origin ?? "repository-context",
});

function normalizeType(kind: string): string {
  const types: Record<string, string> = {
    repository: "REPOSITORY",
    file: "FILE",
    symbol: "SYMBOL",
    callGraph: "CALL_GRAPH",
    dependencyGraph: "DEPENDENCY",
    reverseDependency: "REVERSE_DEPENDENCY",
    circularDependency: "DEPENDENCY",
    impact: "IMPACT",
    deadCode: "DEAD_CODE",
    knowledgeGraph: "KNOWLEDGE_GRAPH",
    metrics: "METRICS",
    architecture: "ARCHITECTURE",
  };
  return types[kind] ?? kind.toUpperCase();
}

function getPath(chunk: AiChunk): string | undefined {
  for (const key of ["path", "file", "nodeId", "workspace"] as const) {
    const value = chunk.metadata[key];
    if (typeof value === "string") return value;
  }

  return undefined;
}

function getSymbol(chunk: AiChunk): string | undefined {
  if (chunk.kind === "symbol") return chunk.title.replace(/^[^:]+:\s*/, "");

  for (const key of ["symbol", "function", "caller", "relationship"] as const) {
    const value = chunk.metadata[key];
    if (typeof value === "string") return value;
  }

  return undefined;
}