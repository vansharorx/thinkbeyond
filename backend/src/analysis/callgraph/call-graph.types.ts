export interface CallGraphEdge {
  caller: string;
  callee: string;
}

export interface CallGraph {
  nodes: string[];
  edges: CallGraphEdge[];
}
