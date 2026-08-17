export interface AiResponseEnvelope<T> {
  provider: string;
  data: T;
}

export interface AiStructuredText {
  summary: string;
  details: string;
}

export interface AiRankingRequest {
  query: string;
  text: string;
  score: number;
}

export interface AiChunk {
  id: string;
  kind: string;
  title: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface AiRetrievalResult {
  query: string;
  chunks: AiChunk[];
}
