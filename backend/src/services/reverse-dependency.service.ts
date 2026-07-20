import {
  DependencyGraph,
} from "./dependency-graph.service";

export interface ReverseDependencyNode {
  file: string;
  usedBy: string[];
}

export interface ReverseDependencyGraph {
  nodes: ReverseDependencyNode[];
}

export const buildReverseDependencyGraph = (
  dependencyGraph: DependencyGraph
): ReverseDependencyGraph => {

  const reverseMap = new Map<string, string[]>();

  // Create an entry for every file
  for (const node of dependencyGraph.nodes) {
    reverseMap.set(node.file, []);
  }

  // Build reverse edges
  for (const node of dependencyGraph.nodes) {

    for (const importedFile of node.imports) {

      const users = reverseMap.get(importedFile);

      if (users) {
        users.push(node.file);
      }

    }

  }

  const nodes: ReverseDependencyNode[] = [];

  for (const [file, usedBy] of reverseMap) {

    nodes.push({
      file,
      usedBy,
    });

  }

  return {
    nodes,
  };

};