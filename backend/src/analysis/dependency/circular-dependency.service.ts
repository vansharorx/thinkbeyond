import {
  DependencyGraph,
} from "./dependency-graph.service";

export interface CircularDependency {
  cycle: string[];
}

export interface CircularDependencyAnalysis {
  cycles: CircularDependency[];
}

export const detectCircularDependencies = (
  graph: DependencyGraph
): CircularDependencyAnalysis => {

  const cycles: CircularDependency[] = [];

  const visited = new Set<string>();

  const stack = new Set<string>();

  const dfs = (
    file: string,
    path: string[]
  ) => {

    visited.add(file);

    stack.add(file);

    path.push(file);

    const node = graph.nodes.find(
      n => n.file === file
    );

    if (node) {

      for (const dependency of node.imports) {

        if (!visited.has(dependency)) {

          dfs(
            dependency,
            [...path]
          );

        }

        else if (stack.has(dependency)) {

          const index =
            path.indexOf(dependency);

          cycles.push({

            cycle: [
              ...path.slice(index),
              dependency,
            ],

          });

        }

      }

    }

    stack.delete(file);

  };

  for (const node of graph.nodes) {

    if (!visited.has(node.file)) {

      dfs(node.file, []);

    }

  }

  return {
    cycles,
  };

};