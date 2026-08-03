import type { WorkspaceAnalysis } from "../../services/workspace.service";
import type { CallGraph, CallGraphEdge } from "./call-graph.types";

export const buildRepositoryCallGraph = (
  workspaces: WorkspaceAnalysis[]
): CallGraph => {
  const edgeSet = new Set<string>();
  const nodes = new Set<string>();

  for (const workspace of workspaces) {
    for (const sourceFile of workspace.sourceFiles) {
      const ast = sourceFile.ast;
      if (!ast) continue;

      for (const fn of ast.functions) {
        nodes.add(fn.name);
      }

      for (const m of ast.methods) {
        nodes.add(m.name);
      }

      for (const call of ast.functionCalls) {
        const key = `${call.caller}::${call.callee}`;
        edgeSet.add(key);
        nodes.add(call.caller);
        nodes.add(call.callee);
      }
    }
  }

  const edges: CallGraphEdge[] = Array.from(edgeSet).map(k => {
    const [caller, callee] = k.split("::");
    return { caller, callee };
  });

  return {
    nodes: Array.from(nodes),
    edges,
  };
};
