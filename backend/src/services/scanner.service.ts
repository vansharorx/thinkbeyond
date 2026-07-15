import fs from "fs/promises";
import path from "path";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
]);

const IMPORTANT_FILES = new Set([
  "README.md",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  ".gitignore",
  "tsconfig.json",
  "vite.config.ts",
  "next.config.js",
  "next.config.ts",
]);

export interface RepositoryManifest {
  totalFiles: number;
  directories: string[];
  importantFiles: string[];
  fileExtensions: Record<string, number>;
}

export const scanRepository = async (
  repositoryPath: string
): Promise<RepositoryManifest> => {

  const directories = new Set<string>();
  const importantFiles: string[] = [];
  const fileExtensions: Record<string, number> = {};

  let totalFiles = 0;

  async function walk(currentPath: string) {

    const entries = await fs.readdir(currentPath, {
      withFileTypes: true,
    });

    for (const entry of entries) {

      if (
        entry.isDirectory() &&
        IGNORED_DIRECTORIES.has(entry.name)
      ) {
        continue;
      }

      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {

        directories.add(
          path.relative(repositoryPath, fullPath)
        );

        await walk(fullPath);

      } else {

        totalFiles++;

        if (IMPORTANT_FILES.has(entry.name)) {
          importantFiles.push(
            path.relative(repositoryPath, fullPath)
          );
        }

        const extension = path.extname(entry.name);

        if (extension) {
          fileExtensions[extension] =
            (fileExtensions[extension] || 0) + 1;
        }

      }

    }

  }

  await walk(repositoryPath);

  return {
    totalFiles,
    directories: [...directories],
    importantFiles,
    fileExtensions,
  };

};