import type { AiChunk } from "../ai.types";
import type { EvidenceItem } from "./intelligence.types";

export const evidenceFromChunk = (chunk: AiChunk): EvidenceItem => ({
  type: normalizeType(chunk.kind),
  path: typeof chunk.metadata.path === "string" ? chunk.metadata.path : undefined,
  symbol: chunk.kind === "symbol" ? chunk.title.replace(/^[^:]+:\s*/, "") : undefined,
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
  };
  return types[kind] ?? kind.toUpperCase();
}