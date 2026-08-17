import { loadRepositoryExplorerState } from "../../services/repository-explorer-state.service";
import { buildFileContext } from "../context/file-context.service";
import { runAiTask } from "./ai-runner.service";

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
}

export const explainFile = async (
  repositoryId: string,
  filePath: string
): Promise<ExplainFileResponse | null> => {
  const state = await loadRepositoryExplorerState(repositoryId);
  if (!state) {
    return null;
  }

  const file = buildFileContext(state, filePath);
  if (!file) {
    return null;
  }

  const prompt = await runAiTask("explainFile", file, filePath);

  return {
    repositoryId,
    provider: prompt.provider,
    file,
    summary: prompt.content,
    purpose: inferPurpose(file),
    dependencies: file.dependencies.flatMap(dependency => dependency.imports),
    imports: file.imports,
    exports: file.exports,
    architectureRole: inferArchitectureRole(file.path),
    potentialImprovements: inferImprovements(file, prompt.content),
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
