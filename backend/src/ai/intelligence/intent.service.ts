import type { IntelligenceIntent, IntelligenceRequest } from "./intelligence.types";

export const determineIntent = (request: IntelligenceRequest): IntelligenceIntent => {
  if (request.intent) return request.intent;
  if (request.template === "explainFile") return "file_explanation";
  if (request.template === "explainSymbol") return "symbol_explanation";
  if (request.template === "architectureReview") return "architecture_review";
  if (request.template === "generateDocumentation") return "documentation";

  const task = request.task.toLowerCase();
  if (/dependenc|import|package/.test(task)) return "dependency_question";
  if (/impact|affected|depend on|downstream/.test(task)) return "impact_question";
  if (/dead code|unused|unreachable/.test(task)) return "dead_code_question";
  if (/code|function|class|module|implementation/.test(task)) return "general_code_question";
  return "repository_question";
};