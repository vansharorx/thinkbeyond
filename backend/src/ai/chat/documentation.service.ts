import { loadRepositoryExplorerState } from "../../services/repository-explorer-state.service";
import { runRepositoryIntelligence } from "../intelligence/intelligence-orchestrator.service";
import type { EvidenceItem, IntelligenceMetadata } from "../intelligence/intelligence.types";

export interface DocumentationResponse {
  repositoryId: string;
  provider: string;
  repositoryMarkdown: string;
  architectureMarkdown: string;
  apiMarkdown: string;
  moduleMarkdown: string;
  evidence: EvidenceItem[];
  metadata: IntelligenceMetadata;
}

export const generateDocumentation = async (
  repositoryId: string,
  scope: "repository" | "architecture" | "api" | "module" = "repository"
): Promise<DocumentationResponse | null> => {
  const state = await loadRepositoryExplorerState(repositoryId);
  if (!state) {
    return null;
  }

  const documentationContext = {
    summary: state.summary,
    knowledge: state.knowledge,
    workspaces: state.workspaces.map(workspace => ({
      name: workspace.name,
      relativePath: workspace.relativePath,
      fileCount: workspace.sourceFiles.length,
    })),
    scope,
  };
  const intelligence = await runRepositoryIntelligence({
    repositoryId,
    task: `Generate ${scope} documentation.`,
    template: "generateDocumentation",
    context: documentationContext,
  });
  if (!intelligence) return null;

  const repositoryMarkdown = buildRepositoryMarkdown(state, intelligence.answer);
  const architectureMarkdown = buildArchitectureMarkdown(state, intelligence.answer);
  const apiMarkdown = buildApiMarkdown(state, intelligence.answer);
  const moduleMarkdown = buildModuleMarkdown(state, intelligence.answer);

  return {
    repositoryId,
    provider: intelligence.provider,
    repositoryMarkdown,
    architectureMarkdown,
    apiMarkdown,
    moduleMarkdown,
    evidence: intelligence.evidence,
    metadata: intelligence.metadata,
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
