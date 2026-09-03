import env from "../../config/env";
import type { AIRequestOptions } from "../../services/llm.service";
import { AIProviderError, type AIProvider, type AIResponse } from "./provider.interface";
import { providerRequestError, requireContent, withProviderTimeout } from "./provider-utils";

export class GeminiProvider implements AIProvider {
  public readonly name = "gemini";

  async generate(prompt: string, options?: AIRequestOptions): Promise<AIResponse> {
    if (!env.GEMINI_API_KEY) {
      throw new AIProviderError("Gemini API key is missing", "configuration", 500);
    }

    const model = env.GEMINI_MODEL || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

    const controller = withProviderTimeout(options?.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }),
      });
      if (!response.ok) {
        const message = response.status === 401 || response.status === 403 ? "Gemini API key is invalid" : response.status === 429 ? "Gemini rate limit exceeded" : `Gemini request failed (status ${response.status})`;
        throw new AIProviderError(message, "request", response.status === 429 ? 429 : 502);
      }
      const json = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; modelVersion?: string; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } };
      return {
        provider: this.name,
        model: json.modelVersion || model,
        content: requireContent(this.name, json.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("")),
        usage: json.usageMetadata ? { inputTokens: json.usageMetadata.promptTokenCount, outputTokens: json.usageMetadata.candidatesTokenCount, totalTokens: json.usageMetadata.totalTokenCount } : undefined,
      };
    } catch (error) {
      throw providerRequestError("Gemini", error);
    } finally {
      controller.clear();
    }
  }
}
