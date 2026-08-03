import type { WorkspaceAnalysis } from "../../services/workspace.service";
import type { CallGraph } from "../callgraph/call-graph.types";

export interface RepositoryMetrics {
  totalFiles: number;
  totalSymbols: number;
  totalFunctions: number;
  totalClasses: number;
  totalInterfaces: number;
  totalEnums: number;
  totalTypeAliases: number;
  totalDependencies: number;
  totalFunctionCalls: number;
  deadCodeCount: number;
}

export const computeRepositoryMetrics = (
  workspaces: WorkspaceAnalysis[],
  callGraph: CallGraph,
  deadCodeCount: number
): RepositoryMetrics => {
  let totalFiles = 0;
  let totalSymbols = 0;
  let totalFunctions = 0;
  let totalClasses = 0;
  let totalInterfaces = 0;
  let totalEnums = 0;
  let totalTypeAliases = 0;
  let totalDependencies = 0;
  let totalFunctionCalls = callGraph.edges.length;

  for (const ws of workspaces) {
    totalFiles += ws.sourceFiles.length;
    totalDependencies += ws.dependencyGraph.nodes.length;
    for (const sf of ws.sourceFiles) {
      totalSymbols += sf.symbolTable.size;
      if (!sf.ast) continue;
      totalFunctions += sf.ast.functions.length;
      totalClasses += sf.ast.classes.length;
      totalInterfaces += sf.ast.interfaces.length;
      totalEnums += sf.ast.enums.length;
      totalTypeAliases += sf.ast.typeAliases.length;
    }
  }

  return {
    totalFiles,
    totalSymbols,
    totalFunctions,
    totalClasses,
    totalInterfaces,
    totalEnums,
    totalTypeAliases,
    totalDependencies,
    totalFunctionCalls,
    deadCodeCount,
  };
};
