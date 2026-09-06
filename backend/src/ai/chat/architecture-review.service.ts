import { loadRepositoryExplorerState } from "../../services/repository-explorer-state.service";
import { runRepositoryIntelligence } from "../intelligence/intelligence-orchestrator.service";
import type { EvidenceItem, IntelligenceMetadata } from "../intelligence/intelligence.types";

export interface ArchitectureReviewResponse {
  repositoryId: string;
  provider: string;
  summary: string;
  layering: string[];
  circularDependencies: string[][];
  deadCode: {
    unusedFunctions: string[];
    unusedExportedFunctions: string[];
    unreachableFunctions: string[];
  };
  codeSmells: string[];
  largeFiles: Array<{ path: string; size: number; }>; 
  largeFunctions: Array<{ name: string; file: string; line: number; }>;
  health: {
    score: number;
    breakdown: {
      circularPenalty: number;
      deadCodePenalty: number;
      dependencyPenalty: number;
    };
  };
  evidence: EvidenceItem[];
  metadata: IntelligenceMetadata;
}

export const reviewArchitecture = async (
  repositoryId: string
): Promise<ArchitectureReviewResponse | null> => {
  const state = await loadRepositoryExplorerState(repositoryId);
  if (!state) {
    return null;
  }

  const intelligence = await runRepositoryIntelligence({
    repositoryId,
    task: "Review the repository architecture.",
    template: "architectureReview",
  });
  if (!intelligence) return null;

  return {
    repositoryId,
    provider: intelligence.provider,
    summary: intelligence.answer,
    layering: reviewLayering(state),
    circularDependencies: state.workspaces.flatMap(workspace => workspace.circularDependencies.cycles.map(cycle => cycle.cycle)),
    deadCode: state.knowledge.deadCode,
    codeSmells: collectCodeSmells(state),
    largeFiles: collectLargeFiles(state),
    largeFunctions: collectLargeFunctions(state),
    health: state.knowledge.health,
    evidence: intelligence.evidence,
    metadata: intelligence.metadata,
  };
};

function reviewLayering(state: Awaited<ReturnType<typeof loadRepositoryExplorerState>> extends infer T ? NonNullable<T> : never): string[] {
  return [
    `Repository summary: ${state.summary.workspaceCount} workspace(s)`,
    `Total files: ${state.knowledge.metrics.totalFiles}`,
    `Total dependencies: ${state.knowledge.metrics.totalDependencies}`,
  ];
}

function collectCodeSmells(state: NonNullable<Awaited<ReturnType<typeof loadRepositoryExplorerState>>>) {
  const smells: string[] = [];

  if (state.knowledge.deadCode.unusedFunctions.length > 0) {
    smells.push("Unused functions present in repository analysis.");
  }

  if (state.knowledge.health.score < 70) {
    smells.push("Repository health score is below recommended threshold.");
  }

  if (state.knowledge.metrics.totalDependencies > state.knowledge.metrics.totalFiles * 4) {
    smells.push("High dependency density detected.");
  }

  return smells;
}

function collectLargeFiles(state: NonNullable<Awaited<ReturnType<typeof loadRepositoryExplorerState>>>) {
  return state.workspaces
    .flatMap(workspace =>
      workspace.sourceFiles.map(file => ({
        path: file.relativePath,
        size: file.size,
      }))
    )
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);
}

function collectLargeFunctions(state: NonNullable<Awaited<ReturnType<typeof loadRepositoryExplorerState>>>) {
  return state.workspaces
    .flatMap(workspace =>
      workspace.sourceFiles.flatMap(file =>
        (file.ast?.functions ?? []).map(fn => ({
          name: fn.name,
          file: file.relativePath,
          line: fn.startLine,
        }))
      )
    )
    .slice(0, 10);
}
