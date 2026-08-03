import type { WorkspaceAnalysis } from "../../services/workspace.service";
import type { CallGraph } from "../callgraph/call-graph.types";

export interface DeadCodeReport {
  unusedFunctions: string[];
  unusedExportedFunctions: string[];
  unreachableFunctions: string[];
}

export const analyzeDeadCode = (
  workspaces: WorkspaceAnalysis[],
  callGraph: CallGraph
): DeadCodeReport => {
  const allFunctions = new Map<string, { exported: boolean }>();

  for (const ws of workspaces) {
    for (const sf of ws.sourceFiles) {
      if (!sf.ast) continue;
      for (const f of sf.ast.functions) {
        allFunctions.set(f.name, { exported: f.exported });
      }
    }
  }

  const callersMap = new Map<string, Set<string>>();
  for (const e of callGraph.edges) {
    if (!callersMap.has(e.callee)) callersMap.set(e.callee, new Set());
    callersMap.get(e.callee)!.add(e.caller);
  }

  const unusedFunctions: string[] = [];
  const unusedExportedFunctions: string[] = [];

  for (const [name, info] of allFunctions) {
    const callers = callersMap.get(name);
    if (!callers || callers.size === 0) {
      unusedFunctions.push(name);
      if (info.exported) unusedExportedFunctions.push(name);
    }
  }

  // Reachability from exported functions
  const forward = new Map<string, string[]>();
  for (const e of callGraph.edges) {
    forward.set(e.caller, (forward.get(e.caller) || []).concat(e.callee));
  }

  const startPoints: string[] = [];
  for (const [name, info] of allFunctions) if (info.exported) startPoints.push(name);

  const reachable = new Set<string>();
  const stack = [...startPoints];
  while (stack.length) {
    const cur = stack.pop()!;
    if (reachable.has(cur)) continue;
    reachable.add(cur);
    const children = forward.get(cur) || [];
    for (const c of children) stack.push(c);
  }

  const unreachableFunctions = [] as string[];
  for (const name of allFunctions.keys()) {
    if (!reachable.has(name)) unreachableFunctions.push(name);
  }

  return {
    unusedFunctions,
    unusedExportedFunctions,
    unreachableFunctions,
  };
};
