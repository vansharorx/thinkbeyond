import { SYSTEM_PROMPT } from "./system-prompt";
import {
  buildArchitectureReviewTemplate,
  buildExplainFileTemplate,
  buildExplainRepositoryTemplate,
  buildExplainSymbolTemplate,
  buildGenerateDocumentationTemplate,
  buildPerformanceReviewTemplate,
  buildRefactoringSuggestionsTemplate,
  buildSecurityReviewTemplate,
} from "./templates";

export type PromptTemplateName =
  | "explainRepository"
  | "explainFile"
  | "explainSymbol"
  | "architectureReview"
  | "securityReview"
  | "performanceReview"
  | "generateDocumentation"
  | "refactoringSuggestions";

export interface PromptBundle {
  systemPrompt: string;
  userPrompt: string;
  prompt: string;
}

export const buildPrompt = (
  template: PromptTemplateName,
  context: unknown,
  question?: string
): PromptBundle => {
  const userPrompt = buildUserPrompt(template, context, question);

  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    prompt: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
  };
};

function buildUserPrompt(
  template: PromptTemplateName,
  context: unknown,
  question?: string
): string {
  switch (template) {
    case "explainRepository":
      return buildExplainRepositoryTemplate({
        repository: (context as { repository: unknown }).repository,
        retrieval: (context as { retrieval: unknown }).retrieval,
        question,
      });
    case "explainFile":
      return buildExplainFileTemplate({ file: context, question });
    case "explainSymbol":
      return buildExplainSymbolTemplate({ symbol: context, question });
    case "architectureReview":
      return buildArchitectureReviewTemplate({ repository: context, question });
    case "securityReview":
      return buildSecurityReviewTemplate({ repository: context, question });
    case "performanceReview":
      return buildPerformanceReviewTemplate({ repository: context, question });
    case "generateDocumentation":
      return buildGenerateDocumentationTemplate({ repository: context, question });
    case "refactoringSuggestions":
      return buildRefactoringSuggestionsTemplate({ repository: context, question });
    default:
      return String(context ?? "");
  }
}
