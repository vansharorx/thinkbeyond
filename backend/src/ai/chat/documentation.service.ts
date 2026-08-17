import { loadRepositoryExplorerState } from "../../services/repository-explorer-state.service";
import { runAiTask } from "./ai-runner.service";

export interface DocumentationResponse {
  repositoryId: string;
  provider: string;
  repositoryMarkdown: string;
  architectureMarkdown: string;
  apiMarkdown: string;
  moduleMarkdown: string;
}

export const generateDocumentation = async (
  repositoryId: string,
  scope: "repository" | "architecture" | "api" | "module" = "repository"
): Promise<DocumentationResponse | null> => {
  const state = await loadRepositoryExplorerState(repositoryId);
  if (!state) {
    return null;
  }

  const prompt = await runAiTask("generateDocumentation", {
    summary: state.summary,
    knowledge: state.knowledge,
    workspaces: state.workspaces.map(workspace => ({
      name: workspace.name,
      relativePath: workspace.relativePath,
      fileCount: workspace.sourceFiles.length,
    })),
    scope,
  });

  const repositoryMarkdown = buildRepositoryMarkdown(state, prompt.content);
  const architectureMarkdown = buildArchitectureMarkdown(state, prompt.content);
  const apiMarkdown = buildApiMarkdown(state, prompt.content);
  const moduleMarkdown = buildModuleMarkdown(state, prompt.content);

  return {
    repositoryId,
    provider: prompt.provider,
    repositoryMarkdown,
    architectureMarkdown,
    apiMarkdown,
    moduleMarkdown,
  };
};

function buildRepositoryMarkdown(state: NonNullable<Awaited<ReturnType<typeof loadRepositoryExplorerState>>>, analysis: string): string {
  return `# Repository Documentation\n\n## Summary\n${JSON.stringify(state.summary, null, 2)}\n\n## Analysis\n${analysis}`;
}

function buildArchitectureMarkdown(state: NonNullable<Awaited<ReturnType<typeof loadRepositoryExplorerState>>>, analysis: string): string {
  return `# Architecture Documentation\n\n## Health\n${JSON.stringify(state.knowledge.health, null, 2)}\n\n## Analysis\n${analysis}`;
}

function buildApiMarkdown(state: NonNullable<Awaited<ReturnType<typeof loadRepositoryExplorerState>>>, analysis: string): string {
  return `# API Documentation\n\n## Workspaces\n${JSON.stringify(state.workspaces.map(workspace => ({ name: workspace.name, relativePath: workspace.relativePath })), null, 2)}\n\n## Analysis\n${analysis}`;
}

function buildModuleMarkdown(state: NonNullable<Awaited<ReturnType<typeof loadRepositoryExplorerState>>>, analysis: string): string {
  return `# Module Documentation\n\n## Metrics\n${JSON.stringify(state.knowledge.metrics, null, 2)}\n\n## Analysis\n${analysis}`;
}
