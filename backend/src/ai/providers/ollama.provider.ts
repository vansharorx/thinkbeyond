import env from "../../config/env";
import type { LLMRequest, LLMResponse } from "../../services/llm.service";
import type { AIProvider } from "./provider.interface";

export class OllamaProvider implements AIProvider {
  public readonly name = "ollama";

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const baseUrl = env.OLLAMA_BASE_URL || "http://localhost:11434";
    const model = env.OLLAMA_MODEL || "llama3.1";

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: request.prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status ${response.status}`);
    }

    const json = await response.json() as {
      response?: string;
      message?: { content?: string };
    };

    return {
      content: (json.response || json.message?.content || "").trim(),
    };
  }
}
