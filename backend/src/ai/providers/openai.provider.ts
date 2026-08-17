import env from "../../config/env";
import type { LLMRequest, LLMResponse } from "../../services/llm.service";
import type { AIProvider } from "./provider.interface";

export class OpenAIProvider implements AIProvider {
  public readonly name = "openai";

  async generate(request: LLMRequest): Promise<LLMResponse> {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const model = env.OPENAI_MODEL || "gpt-4o-mini";
    const baseUrl = env.OPENAI_BASE_URL || "https://api.openai.com/v1";

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are ThinkBeyond, an AI software architecture and code intelligence assistant." },
          { role: "user", content: request.prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}`);
    }

    const json = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return {
      content: json.choices?.[0]?.message?.content?.trim() || "",
    };
  }
}
