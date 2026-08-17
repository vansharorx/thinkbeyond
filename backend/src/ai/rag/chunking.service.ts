import type { AiChunk } from "../ai.types";

export const chunkText = (
  kind: string,
  title: string,
  content: string,
  metadata: Record<string, unknown> = {},
  score = 1
): AiChunk => ({
  id: `${kind}:${title}`,
  kind,
  title,
  content,
  score,
  metadata,
});
