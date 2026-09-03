import env from "../../config/env";
import type { AIProvider } from "./provider.interface";
import { OpenAIProvider } from "./openai.provider";
import { GeminiProvider } from "./gemini.provider";
import { OllamaProvider } from "./ollama.provider";
import { AIProviderError } from "./provider.interface";

class OfflineProvider implements AIProvider {
  public readonly name = "offline";

  async generate(): Promise<{ provider: string; content: string }> {
    return {
      provider: this.name,
      content: "[offline] No external LLM was called. Configure AI_PROVIDER and provider credentials for generated responses.",
    };
  }
}

export const createAIProvider = (): AIProvider => {
  const provider = (env.AI_PROVIDER || "").toLowerCase();

  if (provider === "openai") {
    if (!env.OPENAI_API_KEY) throw new AIProviderError("OpenAI API key is missing", "configuration", 500);
    return new OpenAIProvider();
  }

  if (provider === "gemini") {
    if (!env.GEMINI_API_KEY) throw new AIProviderError("Gemini API key is missing", "configuration", 500);
    return new GeminiProvider();
  }

  if (provider === "ollama") {
    return new OllamaProvider();
  }

  if (provider === "offline") {
    return new OfflineProvider();
  }

  if (provider) {
    throw new AIProviderError(`Unsupported AI provider: ${provider}`, "configuration", 500);
  }

  if (env.OPENAI_API_KEY) {
    return new OpenAIProvider();
  }

  if (env.GEMINI_API_KEY) {
    return new GeminiProvider();
  }

  if (env.OLLAMA_BASE_URL) {
    return new OllamaProvider();
  }

  return new OfflineProvider();
};
