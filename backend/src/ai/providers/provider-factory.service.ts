import env from "../../config/env";
import type { AIProvider } from "./provider.interface";
import { OpenAIProvider } from "./openai.provider";
import { GeminiProvider } from "./gemini.provider";
import { OllamaProvider } from "./ollama.provider";

class OfflineProvider implements AIProvider {
  public readonly name = "offline";

  async generate(): Promise<{ content: string }> {
    return {
      content: "AI provider is not configured. Set AI_PROVIDER or configure OPENAI_API_KEY, GEMINI_API_KEY, or OLLAMA_BASE_URL.",
    };
  }
}

export const createAIProvider = (): AIProvider => {
  const provider = (env.AI_PROVIDER || "").toLowerCase();

  if (provider === "openai") {
    return new OpenAIProvider();
  }

  if (provider === "gemini") {
    return new GeminiProvider();
  }

  if (provider === "ollama") {
    return new OllamaProvider();
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
