import { buildFileContext } from "../context/file-context.service";
import { runRepositoryIntelligence } from "../intelligence/intelligence-orchestrator.service";
import type { EvidenceItem, IntelligenceMetadata } from "../intelligence/intelligence.types";

export interface ExplainFileResponse {
  repositoryId: string;
  provider: string;
  file: NonNullable<ReturnType<typeof buildFileContext>>;
  summary: string;
  purpose: string;
  dependencies: string[];
  imports: unknown[];
  exports: unknown[];
  architectureRole: string;
  potentialImprovements: string[];
  evidence: EvidenceItem[];
  metadata: IntelligenceMetadata;
}

export const explainFile = async (
  repositoryId: string,
  filePath: string
): Promise<ExplainFileResponse | null> => {
  const intelligence = await runRepositoryIntelligence({
    repositoryId,
    task: `Explain file ${filePath}`,
    template: "explainFile",
    filePath,
  });
  if (!intelligence || !intelligence.structuredContext.file) return null;
  const file = intelligence.structuredContext.file;

  return {
    repositoryId,
    provider: intelligence.provider,
    file,
    summary: intelligence.answer,
    purpose: inferPurpose(file),
    dependencies: file.dependencies.flatMap(dependency => dependency.imports),
    imports: file.imports,
    exports: file.exports,
    architectureRole: inferArchitectureRole(file.path),
    potentialImprovements: inferImprovements(file, intelligence.answer),
    evidence: intelligence.evidence,
    metadata: intelligence.metadata,
  };
};

function inferPurpose(file: NonNullable<ReturnType<typeof buildFileContext>>): string {
  if (file.functions.length > 0) {
    return `Defines ${file.functions.length} function(s) in the repository.`;
  }

  if (file.classes.length > 0) {
    return `Defines ${file.classes.length} class(es) in the repository.`;
  }

  if (file.interfaces.length > 0) {
    return `Defines ${file.interfaces.length} interface(s) in the repository.`;
  }

  return `Represents repository code in ${file.path}.`;
}

function inferArchitectureRole(filePath: string): string {
  const normalized = filePath.toLowerCase();
  if (normalized.includes("/analysis/")) return "analysis";
  if (normalized.includes("/controllers/")) return "api controller";
  if (normalized.includes("/routes/")) return "routing";
  if (normalized.includes("/repositories/")) return "data access";
  if (normalized.includes("/services/")) return "application service";
  if (normalized.includes("/middlewares/")) return "cross-cutting middleware";
  if (normalized.includes("/config/")) return "configuration";
  if (normalized.includes("/utils/")) return "shared utility";
  return "application module";
}

function inferImprovements(
  file: NonNullable<ReturnType<typeof buildFileContext>>,
  summary: string
): string[] {
  const improvements: string[] = [];

  if (file.deadCode.isDeadCode) {
    improvements.push("Review unused symbols identified in the file.");
  }

  if (file.dependencies.length > 5) {
    improvements.push("Consider reducing coupling to downstream dependencies.");
  }

  if (file.functionCalls.length === 0 && file.functions.length > 0) {
    improvements.push("Confirm the file has the expected functional responsibility.");
  }

  if (summary.trim().length > 0) {
    improvements.push("Use the generated summary as a review starting point.");
  }

  return improvements;
}
