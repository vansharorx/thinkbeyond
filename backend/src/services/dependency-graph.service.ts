import path from "path";
import { SourceFile } from "./source-indexer.service";

export interface DependencyNode {
  file: string;
  imports: string[];
}

export interface DependencyGraph {
  nodes: DependencyNode[];
}

export const buildDependencyGraph = (
  sourceFiles: SourceFile[]
): DependencyGraph => {

  const nodes: DependencyNode[] = [];

  for (const file of sourceFiles) {

    const resolvedImports: string[] = [];

    for (const imported of file.imports) {

      if (imported.type === "external") {
        continue;
      }

      const importerDirectory = path.dirname(file.relativePath);

      const resolvedPath = path
        .normalize(
          path.join(importerDirectory, imported.module)
        )
        .replace(/\\/g, "/");

      const target = sourceFiles.find(source => {

        const withoutExtension =
          source.relativePath.replace(/\.(ts|tsx|js|jsx)$/, "");

        return (
          withoutExtension === resolvedPath ||
          source.relativePath === resolvedPath
        );

      });

      if (target) {
        resolvedImports.push(target.relativePath);
      }

    }

    nodes.push({
      file: file.relativePath,
      imports: resolvedImports,
    });

  }

  return {
    nodes,
  };

};