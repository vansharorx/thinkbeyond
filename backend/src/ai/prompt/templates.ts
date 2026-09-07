export interface ExplainRepositoryTemplateContext {
  repository: unknown;
  retrieval: unknown;
  question?: string;
}

export interface ExplainFileTemplateContext {
  file: unknown;
  question?: string;
}

export interface ExplainSymbolTemplateContext {
  symbol: unknown;
  question?: string;
}

export interface ArchitectureReviewTemplateContext {
  repository: unknown;
  question?: string;
}

export interface DocumentationTemplateContext {
  repository: unknown;
  scope?: "repository" | "architecture" | "api" | "module";
  question?: string;
}

export const buildExplainRepositoryTemplate = (context: ExplainRepositoryTemplateContext): string => `Explain this repository using the structured intelligence below.

Repository Context:
${stringify(context.repository)}

Retrieved Context:
${stringify(context.retrieval)}

STRUCTURAL EVIDENCE:
Use dependency, reverse-dependency, call-graph, impact, dead-code, knowledge-graph, metrics, and architecture entries when they are present. Treat them as repository facts and do not infer unsupported relationships.

Question:
${context.question ?? "Explain the repository."}
`;

export const buildExplainFileTemplate = (context: ExplainFileTemplateContext): string => `Explain this file using the structured analysis below.

File Context:
${stringify(context.file)}

Question:
${context.question ?? "Explain this file."}
`;

export const buildExplainSymbolTemplate = (context: ExplainSymbolTemplateContext): string => `Explain this symbol using the structured analysis below.

Symbol Context:
${stringify(context.symbol)}

Question:
${context.question ?? "Explain this symbol."}
`;

export const buildArchitectureReviewTemplate = (context: ArchitectureReviewTemplateContext): string => `Perform an architecture review using the structured repository intelligence below.

Repository Context:
${stringify(context.repository)}

Question:
${context.question ?? "Review the repository architecture."}
`;

export const buildSecurityReviewTemplate = (context: ArchitectureReviewTemplateContext): string => `Perform a security review using the structured repository intelligence below.

Repository Context:
${stringify(context.repository)}

Question:
${context.question ?? "Review the repository for security concerns."}
`;

export const buildPerformanceReviewTemplate = (context: ArchitectureReviewTemplateContext): string => `Perform a performance review using the structured repository intelligence below.

Repository Context:
${stringify(context.repository)}

Question:
${context.question ?? "Review the repository for performance concerns."}
`;

export const buildGenerateDocumentationTemplate = (context: DocumentationTemplateContext): string => `Generate markdown documentation using the structured repository intelligence below.

Repository Context:
${stringify(context.repository)}

Scope: ${context.scope ?? "repository"}

Question:
${context.question ?? "Generate documentation."}
`;

export const buildRefactoringSuggestionsTemplate = (context: ArchitectureReviewTemplateContext): string => `Generate refactoring suggestions using the structured repository intelligence below.

Repository Context:
${stringify(context.repository)}

Question:
${context.question ?? "Suggest refactorings."}
`;

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
