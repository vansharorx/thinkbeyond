import env from "../../config/env";
import type { AIRequestOptions } from "../../services/llm.service";
import { AIProviderError, type AIProvider, type AIResponse } from "./provider.interface";
import { providerRequestError, requireContent, withProviderTimeout } from "./provider-utils";

export class OllamaProvider implements AIProvider {
  public readonly name = "ollama";

  async generate(prompt: string, options?: AIRequestOptions): Promise<AIResponse> {
    const baseUrl = env.OLLAMA_BASE_URL || "http://localhost:11434";
    const model = env.OLLAMA_MODEL || "llama3.1";

    const controller = withProviderTimeout(options?.timeoutMs);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false }),
      });
      if (!response.ok) throw new AIProviderError(`Ollama request failed (status ${response.status})`, "request", 502);
      const json = await response.json() as { response?: string; message?: { content?: string }; model?: string; prompt_eval_count?: number; eval_count?: number };
      const inputTokens = json.prompt_eval_count;
      const outputTokens = json.eval_count;
      return {
        provider: this.name,
        model: json.model || model,
        content: requireContent(this.name, json.response || json.message?.content),
        usage: inputTokens !== undefined || outputTokens !== undefined ? { inputTokens, outputTokens, totalTokens: (inputTokens || 0) + (outputTokens || 0) } : undefined,
      };
    } catch (error) {
      throw providerRequestError("Ollama", error);
    } finally {
      controller.clear();
    }
  }
}
