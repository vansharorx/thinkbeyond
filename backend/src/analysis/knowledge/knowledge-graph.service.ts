import type { WorkspaceAnalysis } from "../../services/workspace.service";
import type { CallGraph } from "../callgraph/call-graph.types";

export interface KGNode {
  id: string;
  type: string;
  meta?: Record<string, unknown>;
}

export interface KGEdge {
  from: string;
  to: string;
  type: string;
}

export interface KnowledgeGraph {
  nodes: KGNode[];
  edges: KGEdge[];
}

export const buildKnowledgeGraph = (
  workspaces: WorkspaceAnalysis[],
  callGraph: CallGraph
): KnowledgeGraph => {
  const nodesMap = new Map<string, KGNode>();
  const edges: KGEdge[] = [];

  for (const ws of workspaces) {
    for (const sf of ws.sourceFiles) {
      const fileId = `file:${sf.relativePath}`;
      if (!nodesMap.has(fileId)) {
        nodesMap.set(fileId, {
          id: fileId,
          type: "file",
          meta: { workspace: ws.name },
        });
      }

      if (sf.ast) {
        for (const fn of sf.ast.functions) {
          const id = `function:${fn.name}`;
          if (!nodesMap.has(id)) {
            nodesMap.set(id, {
              id,
              type: "function",
              meta: { file: sf.relativePath },
            });
          }
          edges.push({ from: fileId, to: id, type: "defines" });
        }

        for (const cls of sf.ast.classes) {
          const id = `class:${cls.name}`;
          if (!nodesMap.has(id)) {
            nodesMap.set(id, {
              id,
              type: "class",
              meta: { file: sf.relativePath },
            });
          }
          edges.push({ from: fileId, to: id, type: "defines" });
        }

        for (const iface of sf.ast.interfaces) {
          const id = `interface:${iface.name}`;
          if (!nodesMap.has(id)) {
            nodesMap.set(id, {
              id,
              type: "interface",
              meta: { file: sf.relativePath },
            });
          }
          edges.push({ from: fileId, to: id, type: "defines" });
        }

        for (const en of sf.ast.enums) {
          const id = `enum:${en.name}`;
          if (!nodesMap.has(id)) {
            nodesMap.set(id, {
              id,
              type: "enum",
              meta: { file: sf.relativePath },
            });
          }
          edges.push({ from: fileId, to: id, type: "defines" });
        }

        for (const ta of sf.ast.typeAliases) {
          const id = `typeAlias:${ta.name}`;
          if (!nodesMap.has(id)) {
            nodesMap.set(id, {
              id,
              type: "typeAlias",
              meta: { file: sf.relativePath },
            });
          }
          edges.push({ from: fileId, to: id, type: "defines" });
        }

        for (const variable of sf.ast.variables) {
          const id = `variable:${variable.name}`;
          if (!nodesMap.has(id)) {
            nodesMap.set(id, {
              id,
              type: "variable",
              meta: { file: sf.relativePath },
            });
          }
          edges.push({ from: fileId, to: id, type: "defines" });
        }
      }

      for (const imp of sf.imports) {
        if (imp.type === "internal") {
          const id = `import:${imp.module}`;
          if (!nodesMap.has(id)) {
            nodesMap.set(id, {
              id,
              type: "import",
              meta: { file: sf.relativePath },
            });
          }
          edges.push({ from: fileId, to: id, type: "imports" });
        }
      }
    }
  }

  for (const e of callGraph.edges) {
    const from = `function:${e.caller}`;
    const to = `function:${e.callee}`;

    if (!nodesMap.has(from)) {
      nodesMap.set(from, { id: from, type: "function" });
    }

    if (!nodesMap.has(to)) {
      nodesMap.set(to, { id: to, type: "function" });
    }

    edges.push({ from, to, type: "calls" });
  }

  for (const ws of workspaces) {
    for (const node of ws.dependencyGraph.nodes) {
      const fileId = `file:${node.file}`;
      if (!nodesMap.has(fileId)) {
        nodesMap.set(fileId, {
          id: fileId,
          type: "file",
          meta: { workspace: ws.name },
        });
      }

      for (const imported of node.imports) {
        const toId = `file:${imported}`;
        if (!nodesMap.has(toId)) {
          nodesMap.set(toId, { id: toId, type: "file" });
        }
        edges.push({ from: fileId, to: toId, type: "depends_on" });
      }
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges,
  };
};
