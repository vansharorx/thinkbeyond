import type { AIRequestOptions, AIUsage } from "../../services/llm.service";

export interface AIResponse {
  provider: string;
  model?: string;
  content: string;
  usage?: AIUsage;
}

export interface AIProvider {
  name: string;
  generate(prompt: string, options?: AIRequestOptions): Promise<AIResponse>;
}

export class AIProviderError extends Error {
  public readonly code: "configuration" | "timeout" | "unavailable" | "request" | "response";
  public readonly statusCode: number;

  constructor(message: string, code: AIProviderError["code"], statusCode = 502) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
