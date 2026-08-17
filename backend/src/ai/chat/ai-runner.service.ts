import { createAIProvider } from "../providers/provider-factory.service";
import { buildPrompt, type PromptTemplateName } from "../prompt/prompt-builder.service";

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
  const response = await provider.generate({ prompt: bundle.prompt });

  return {
    provider: provider.name,
    systemPrompt: bundle.systemPrompt,
    userPrompt: bundle.userPrompt,
    prompt: bundle.prompt,
    content: response.content,
  };
};
