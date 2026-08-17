import type { RepositoryExplorerState } from "../../services/repository-explorer-state.service";
import { searchRepositoryExplorer } from "../../analysis/search/search.service";
import { chunkText } from "./chunking.service";
import { rankChunks } from "./ranking.service";
import type { AiChunk, AiRetrievalResult } from "../ai.types";

export const retrieveRepositoryContext = (
  state: RepositoryExplorerState,
  query: string,
  limit = 8
): AiRetrievalResult => {
  const searchResults = searchRepositoryExplorer(state.workspaces, query, { scope: "all", matchMode: "partial" });
  const chunks: AiChunk[] = [];

  chunks.push(
    chunkText("repository", "Repository Summary", JSON.stringify({
      summary: state.summary,
      metrics: state.knowledge.metrics,
      health: state.knowledge.health,
    }, null, 2), { kind: "repository" }, 10)
  );

  for (const hit of searchResults.files.slice(0, 5)) {
    const file = findFile(state, hit.path);
    if (!file) {
      continue;
    }

    chunks.push(chunkText(
      "file",
      file.relativePath,
      JSON.stringify({
        imports: file.imports,
        exports: file.exports,
        functions: file.ast?.functions ?? [],
        classes: file.ast?.classes ?? [],
        interfaces: file.ast?.interfaces ?? [],
        enums: file.ast?.enums ?? [],
        variables: file.ast?.variables ?? [],
        methods: file.ast?.methods ?? [],
        typeAliases: file.ast?.typeAliases ?? [],
        functionCalls: file.ast?.functionCalls ?? [],
        dependencies: getDependencies(state, file.relativePath),
      }, null, 2),
      { workspace: hit.workspace, path: file.relativePath },
      hit.score
    ));
  }

  for (const hit of searchResults.symbols.slice(0, 10)) {
    chunks.push(chunkText(
      "symbol",
      `${hit.kind}: ${hit.name}`,
      JSON.stringify(hit, null, 2),
      { workspace: hit.workspace, path: hit.path, kind: hit.kind },
      hit.score
    ));
  }

  const graphChunks = state.knowledge.callGraph.edges.slice(0, 20).map(edge => chunkText(
    "callGraph",
    `${edge.caller} -> ${edge.callee}`,
    JSON.stringify(edge, null, 2),
    { caller: edge.caller, callee: edge.callee },
    1
  ));

  chunks.push(...graphChunks);

  const dependencyChunks = state.workspaces.flatMap(workspace =>
    workspace.dependencyGraph.nodes.slice(0, 20).map(node => chunkText(
      "dependencyGraph",
      node.file,
      JSON.stringify(node, null, 2),
      { workspace: workspace.name, file: node.file },
      node.imports.length + 1
    ))
  );

  chunks.push(...dependencyChunks);

  const ranked = rankChunks(chunks, query, limit);

  return {
    query,
    chunks: ranked,
  };
};

function findFile(state: RepositoryExplorerState, relativePath: string) {
  const normalized = normalize(relativePath);
  for (const workspace of state.workspaces) {
    const sourceFile = workspace.sourceFiles.find(file => normalize(file.relativePath) === normalized);
    if (sourceFile) {
      return sourceFile;
    }
  }

  return null;
}

function getDependencies(state: RepositoryExplorerState, relativePath: string): string[] {
  for (const workspace of state.workspaces) {
    const node = workspace.dependencyGraph.nodes.find(item => item.file === relativePath);
    if (node) {
      return node.imports;
    }
  }

  return [];
}

function normalize(value: string): string {
  return value.replace(/\\/g, "/").toLowerCase();
}
