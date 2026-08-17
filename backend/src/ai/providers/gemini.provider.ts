import env from "../../config/env";
import type { LLMRequest, LLMResponse } from "../../services/llm.service";
import type { AIProvider } from "./provider.interface";

export class GeminiProvider implements AIProvider {
  public readonly name = "gemini";

  async generate(request: LLMRequest): Promise<LLMResponse> {
    if (!env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const model = env.GEMINI_MODEL || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: request.prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}`);
    }

    const json = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    return {
      content: json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "",
    };
  }
}
