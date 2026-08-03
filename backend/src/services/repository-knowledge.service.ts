import { WorkspaceAnalysis } from "./workspace.service";
import { buildRepositoryCallGraph } from "../analysis/callgraph/call-graph.builder";
import { analyzeDeadCode, type DeadCodeReport } from "../analysis/deadcode/deadcode.service";
import { buildKnowledgeGraph } from "../analysis/knowledge/knowledge-graph.service";
import { computeRepositoryMetrics, type RepositoryMetrics } from "../analysis/metrics/metrics.service";
import { analyzeImpact, type ImpactResult } from "../analysis/impact/impact-analysis.service";

export interface RepositoryKnowledge {
  workspaces: WorkspaceAnalysis[];
  statistics: {
    totalFiles: number;
    totalSymbols: number;
    totalDependencies: number;
    totalCircularDependencies: number;
  };
  callGraph: import("../analysis/callgraph/call-graph.types").CallGraph;
  knowledgeGraph: import("../analysis/knowledge/knowledge-graph.service").KnowledgeGraph;
  metrics: RepositoryMetrics;
  health: {
    score: number;
    breakdown: {
      circularPenalty: number;
      deadCodePenalty: number;
      dependencyPenalty: number;
    };
  };
  deadCode: DeadCodeReport;
  analyzeImpact: (functionName: string) => ImpactResult;
}

export const buildRepositoryKnowledge = (
  workspaces: WorkspaceAnalysis[]
): RepositoryKnowledge => {
  let totalFiles = 0;
  let totalSymbols = 0;
  let totalDependencies = 0;
  let totalCircularDependencies = 0;

  for (const workspace of workspaces) {
    totalFiles += workspace.sourceFiles.length;
    totalDependencies += workspace.dependencyGraph.nodes.length;
    totalCircularDependencies += workspace.circularDependencies.cycles.length;

    for (const sourceFile of workspace.sourceFiles) {
      totalSymbols += sourceFile.symbolTable.size;
    }
  }

  const callGraph = buildRepositoryCallGraph(workspaces);

  const deadcode = analyzeDeadCode(workspaces, callGraph);

  const knowledgeGraph = buildKnowledgeGraph(workspaces, callGraph);

  const metrics = computeRepositoryMetrics(workspaces, callGraph, deadcode.unusedFunctions.length);

  const circularPenalty = Math.min(totalCircularDependencies * 10, 40);
  const deadCodeRatio = metrics.totalFunctions === 0 ? 0 : (deadcode.unusedFunctions.length / metrics.totalFunctions) * 100;
  const deadCodePenalty = Math.min(Math.round(deadCodeRatio), 40);
  const dependencyDensity = metrics.totalFiles === 0 ? 0 : metrics.totalDependencies / metrics.totalFiles;
  const dependencyPenalty = Math.min(Math.round(dependencyDensity * 5), 20);

  const healthScore = Math.max(0, 100 - (circularPenalty + deadCodePenalty + dependencyPenalty));

  return {
    workspaces,
    statistics: {
      totalFiles,
      totalSymbols,
      totalDependencies,
      totalCircularDependencies,
    },
    callGraph,
    knowledgeGraph,
    metrics,
    health: {
      score: healthScore,
      breakdown: {
        circularPenalty,
        deadCodePenalty,
        dependencyPenalty,
      },
    },
    deadCode: deadcode,
    analyzeImpact: (functionName: string) => analyzeImpact(callGraph, functionName),
  };
};
