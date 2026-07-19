import fs from "fs/promises";
import path from "path";

import { analyzeImports } from "./import-analyzer.service";
import { ImportInfo } from "./import-analyzer.service";
import { ExportInfo } from "./export-analyzer.service";
import { analyzeExports } from "./export-analyzer.service";

export interface SourceFile {
    relativePath: string;
    extension: string;
    size: number;
    lines: number;

    imports: ImportInfo[];
    exports: ExportInfo[];
}

const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json"
];

const IGNORE_DIRECTORIES = [
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage"
];

export const indexSourceFiles = async (
  workspacePath: string
): Promise<SourceFile[]> => {

  const files: SourceFile[] = [];

  await scan(workspacePath);

  return files;

  async function scan(currentPath: string) {

    const entries = await fs.readdir(currentPath, {
      withFileTypes: true,
    });

    for (const entry of entries) {

      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {

        if (IGNORE_DIRECTORIES.includes(entry.name)) {
          continue;
        }

        await scan(fullPath);
        continue;
      }

      const extension = path.extname(entry.name);

      if (!SOURCE_EXTENSIONS.includes(extension)) {
        continue;
      }

      const stats = await fs.stat(fullPath);

      const content = await fs.readFile(
        fullPath,
        "utf-8"
      );

      files.push({
        relativePath: path
            .relative(workspacePath, fullPath)
            .replace(/\\/g, "/"),
        extension,
        size: stats.size,
        lines: content.split("\n").length,
        imports: await analyzeImports(fullPath),
        exports: await analyzeExports(fullPath),
      });

    }

  }

};