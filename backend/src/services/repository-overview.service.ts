import { loadRepositoryExplorerState } from "./repository-explorer-state.service";

export interface RepositoryOverviewLargestFile {
  workspace: string;
  path: string;
  size: number;
  extension: string;
  lineCount: number;
}

export interface RepositoryOverviewDependencyEntry {
  path: string;
  count: number;
}

export interface RepositoryOverviewCalledFunction {
  name: string;
  count: number;
}

export interface RepositoryOverviewResponse {
  repositoryId: string;
  repositoryStatistics: {
    workspaceCount: number;
    totalFiles: number;
    totalSymbols: number;
    totalFunctions: number;
    totalClasses: number;
    totalInterfaces: number;
    totalEnums: number;
    totalDependencies: number;
    totalFunctionCalls: number;
    deadCodeCount: number;
  };
  healthScore: {
    score: number;
    breakdown: {
      circularPenalty: number;
      deadCodePenalty: number;
      dependencyPenalty: number;
    };
  };
  metrics: import("../analysis/metrics/metrics.service").RepositoryMetrics;
  architecture: Array<{
    name: string;
    relativePath: string;
    manifest: unknown;
    readme: unknown;
    packageAnalysis: unknown;
    architecture: unknown;
  }>;
  largestFiles: RepositoryOverviewLargestFile[];
  mostImportedFiles: RepositoryOverviewDependencyEntry[];
  mostCalledFunctions: RepositoryOverviewCalledFunction[];
  circularDependencies: Array<{
    workspace: string;
    cycles: string[][];
  }>;
  deadCodeSummary: {
    unusedFunctions: string[];
    unusedExportedFunctions: string[];
    unreachableFunctions: string[];
  };
}

export const getRepositoryOverview = async (
  repositoryId: string
): Promise<RepositoryOverviewResponse | null> => {
  const state = await loadRepositoryExplorerState(repositoryId);
  if (!state) {
    return null;
  }

  const largestFiles = state.workspaces
    .flatMap(workspace =>
      workspace.sourceFiles.map(sourceFile => ({
        workspace: workspace.name,
        path: sourceFile.relativePath,
        size: sourceFile.size,
        extension: sourceFile.extension,
        lineCount: sourceFile.lines,
      }))
    )
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  const importCounts = new Map<string, number>();
  for (const workspace of state.workspaces) {
    for (const node of workspace.dependencyGraph.nodes) {
      importCounts.set(node.file, (importCounts.get(node.file) ?? 0) + node.imports.length);
    }
  }

  const callCounts = new Map<string, number>();
  for (const edge of state.knowledge.callGraph.edges) {
    callCounts.set(edge.callee, (callCounts.get(edge.callee) ?? 0) + 1);
  }

  const repositoryStatistics = {
    workspaceCount: state.workspaces.length,
    totalFiles: state.knowledge.metrics.totalFiles,
    totalSymbols: state.knowledge.metrics.totalSymbols,
    totalFunctions: state.knowledge.metrics.totalFunctions,
    totalClasses: state.knowledge.metrics.totalClasses,
    totalInterfaces: state.knowledge.metrics.totalInterfaces,
    totalEnums: state.knowledge.metrics.totalEnums,
    totalDependencies: state.knowledge.metrics.totalDependencies,
    totalFunctionCalls: state.knowledge.metrics.totalFunctionCalls,
    deadCodeCount: state.knowledge.metrics.deadCodeCount,
  };

  return {
    repositoryId,
    repositoryStatistics,
    healthScore: state.knowledge.health,
    metrics: state.knowledge.metrics,
    architecture: state.workspaces.map(workspace => ({
      name: workspace.name,
      relativePath: workspace.relativePath,
      manifest: workspace.manifest,
      readme: workspace.readme,
      packageAnalysis: workspace.packageAnalysis,
      architecture: workspace.architecture,
    })),
    largestFiles,
    mostImportedFiles: [...importCounts.entries()]
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    mostCalledFunctions: [...callCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    circularDependencies: state.workspaces.map(workspace => ({
      workspace: workspace.name,
      cycles: workspace.circularDependencies.cycles.map(cycle => cycle.cycle),
    })),
    deadCodeSummary: state.knowledge.deadCode,
  };
};
