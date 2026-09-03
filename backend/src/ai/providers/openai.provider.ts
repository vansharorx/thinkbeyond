import env from "../../config/env";
import type { AIRequestOptions } from "../../services/llm.service";
import { AIProviderError, type AIProvider, type AIResponse } from "./provider.interface";
import { providerRequestError, requireContent, withProviderTimeout } from "./provider-utils";

export class OpenAIProvider implements AIProvider {
  public readonly name = "openai";

  async generate(prompt: string, options?: AIRequestOptions): Promise<AIResponse> {
    if (!env.OPENAI_API_KEY) {
      throw new AIProviderError("OpenAI API key is missing", "configuration", 500);
    }

    const model = env.OPENAI_MODEL || "gpt-4o-mini";
    const baseUrl = env.OPENAI_BASE_URL || "https://api.openai.com/v1";

    const controller = withProviderTimeout(options?.timeoutMs);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [
          { role: "system", content: "You are ThinkBeyond, an AI software architecture and code intelligence assistant." },
          { role: "user", content: prompt },
        ], temperature: 0.2 }),
      });
      if (!response.ok) {
        const message = response.status === 401 ? "OpenAI API key is invalid" : response.status === 429 ? "OpenAI rate limit exceeded" : `OpenAI request failed (status ${response.status})`;
        throw new AIProviderError(message, "request", response.status === 429 ? 429 : 502);
      }
      const json = await response.json() as { choices?: Array<{ message?: { content?: string } }>; model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
      return {
        provider: this.name,
        model: json.model || model,
        content: requireContent(this.name, json.choices?.[0]?.message?.content),
        usage: json.usage ? { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens, totalTokens: json.usage.total_tokens } : undefined,
      };
    } catch (error) {
      throw providerRequestError("OpenAI", error);
    } finally {
      controller.clear();
    }
  }
}
