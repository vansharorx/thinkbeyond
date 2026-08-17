import { buildRepositoryTree } from "../../services/repository-tree.service";
import type { RepositoryExplorerState } from "../../services/repository-explorer-state.service";

export interface RepositoryTreeSummary {
  totalNodes: number;
  directoryCount: number;
  fileCount: number;
  maxDepth: number;
}

export interface RepositoryContext {
  repositoryId: string;
  summary: RepositoryExplorerState["summary"];
  architecture: RepositoryExplorerState["knowledge"]["knowledgeGraph"];
  metrics: RepositoryExplorerState["knowledge"]["metrics"];
  health: RepositoryExplorerState["knowledge"]["health"];
  callGraph: RepositoryExplorerState["knowledge"]["callGraph"];
  dependencyGraph: RepositoryExplorerState["workspaces"][number]["dependencyGraph"][];
  workspaces: Array<{
    name: string;
    relativePath: string;
    fileCount: number;
    symbolCount: number;
    dependencyCount: number;
    circularDependencyCount: number;
  }>;
  tree: {
    summary: RepositoryTreeSummary;
    preview: Awaited<ReturnType<typeof buildRepositoryTree>>;
  };
}

export const buildRepositoryContext = async (
  state: RepositoryExplorerState
): Promise<RepositoryContext> => {
  const preview = await buildRepositoryTree(state.repositoryPath, {
    recursive: true,
    maxDepth: 2,
  });

  return {
    repositoryId: state.repositoryId,
    summary: state.summary,
    architecture: state.knowledge.knowledgeGraph,
    metrics: state.knowledge.metrics,
    health: state.knowledge.health,
    callGraph: state.knowledge.callGraph,
    dependencyGraph: state.workspaces.map(workspace => workspace.dependencyGraph),
    workspaces: state.workspaces.map(workspace => ({
      name: workspace.name,
      relativePath: workspace.relativePath,
      fileCount: workspace.sourceFiles.length,
      symbolCount: workspace.sourceFiles.reduce((count, sourceFile) => count + sourceFile.symbolTable.size, 0),
      dependencyCount: workspace.dependencyGraph.nodes.reduce((count, node) => count + node.imports.length, 0),
      circularDependencyCount: workspace.circularDependencies.cycles.length,
    })),
    tree: {
      summary: summarizeTree(preview),
      preview,
    },
  };
};

function summarizeTree(nodes: Awaited<ReturnType<typeof buildRepositoryTree>>): RepositoryTreeSummary {
  let totalNodes = 0;
  let directoryCount = 0;
  let fileCount = 0;
  let maxDepth = 0;

  const walk = (items: typeof nodes): void => {
    for (const node of items) {
      totalNodes += 1;
      maxDepth = Math.max(maxDepth, node.depth);
      if (node.type === "directory") {
        directoryCount += 1;
        if (node.children) {
          walk(node.children);
        }
      } else {
        fileCount += 1;
      }
    }
  };

  walk(nodes);

  return {
    totalNodes,
    directoryCount,
    fileCount,
    maxDepth,
  };
}
