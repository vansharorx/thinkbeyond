import { createAIProvider } from "../providers/provider-factory.service";
import { AIProviderError } from "../providers/provider.interface";
import { buildPrompt, type PromptTemplateName } from "../prompt/prompt-builder.service";
import env from "../../config/env";

export interface AiRunResult {
  provider: string;
  systemPrompt: string;
  userPrompt: string;
  prompt: string;
  content: string;
}

export const runAiTask = async (
  template: PromptTemplateName,
  context: unknown,
  question?: string
): Promise<AiRunResult> => {
  const provider = createAIProvider();
  const bundle = buildPrompt(template, context, question);
  try {
    const response = await provider.generate(bundle.prompt, { timeoutMs: env.AI_TIMEOUT_MS });

    return {
      provider: response.provider || provider.name,
      systemPrompt: bundle.systemPrompt,
      userPrompt: bundle.userPrompt,
      prompt: bundle.prompt,
      content: response.content,
    };
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    throw new AIProviderError("AI provider request failed", "request", 502);
  }
};
