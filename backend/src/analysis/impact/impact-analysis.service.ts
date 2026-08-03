import type { CallGraph } from "../callgraph/call-graph.types";

export interface ImpactResult {
  callers: string[];
  callees: string[];
  directImpact: string[];
  transitiveImpact: string[];
}

export const analyzeImpact = (
  callGraph: CallGraph,
  functionName: string
): ImpactResult => {
  const edges = callGraph.edges;

  const callers = new Set<string>();
  const callees = new Set<string>();

  for (const e of edges) {
    if (e.callee === functionName) callers.add(e.caller);
    if (e.caller === functionName) callees.add(e.callee);
  }

  const direct = new Set<string>([...callers, ...callees]);

  // Transitive callers (upstream)
  const transitiveCallers = new Set<string>();
  const reverseMap = new Map<string, string[]>();
  for (const e of edges) {
    reverseMap.set(e.callee, (reverseMap.get(e.callee) || []).concat(e.caller));
  }

  const stackC = [...callers];
  while (stackC.length) {
    const cur = stackC.pop()!;
    if (transitiveCallers.has(cur)) continue;
    transitiveCallers.add(cur);
    const parents = reverseMap.get(cur) || [];
    for (const p of parents) stackC.push(p);
  }

  // Transitive callees (downstream)
  const transitiveCallees = new Set<string>();
  const forwardMap = new Map<string, string[]>();
  for (const e of edges) {
    forwardMap.set(e.caller, (forwardMap.get(e.caller) || []).concat(e.callee));
  }

  const stackD = [...callees];
  while (stackD.length) {
    const cur = stackD.pop()!;
    if (transitiveCallees.has(cur)) continue;
    transitiveCallees.add(cur);
    const children = forwardMap.get(cur) || [];
    for (const c of children) stackD.push(c);
  }

  const transitive = new Set<string>([...transitiveCallers, ...transitiveCallees]);

  return {
    callers: Array.from(callers),
    callees: Array.from(callees),
    directImpact: Array.from(direct),
    transitiveImpact: Array.from(transitive),
  };
};
