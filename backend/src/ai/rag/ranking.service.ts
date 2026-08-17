import type { AiChunk } from "../ai.types";

export const rankChunks = (
  chunks: AiChunk[],
  query: string,
  limit = 8
): AiChunk[] => {
  const normalizedQuery = normalize(query);
  const scored = chunks.map(chunk => ({
    chunk,
    score: chunk.score + tokenScore(chunk.title, normalizedQuery) + tokenScore(chunk.content, normalizedQuery),
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => ({
      ...item.chunk,
      score: item.score,
    }));
};

function tokenScore(text: string, query: string): number {
  if (!query) {
    return 0;
  }

  const normalized = normalize(text);
  if (normalized.includes(query)) {
    return 10;
  }

  const tokens = query.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const token of tokens) {
    if (normalized.includes(token)) {
      score += 2;
    }
  }

  return score;
}

function normalize(value: string): string {
  return value.toLowerCase().trim();
}
