import fs from "fs/promises";
import path from "path";

export interface Workspace {
  name: string;
  path: string;
}

export const detectWorkspaces = async (
  repositoryPath: string
): Promise<Workspace[]> => {

  const workspaces: Workspace[] = [];

  await scan(repositoryPath);

  if (workspaces.length === 0) {
    workspaces.push({
      name: path.basename(repositoryPath),
      path: repositoryPath,
    });
  }

  return workspaces;

  async function scan(currentPath: string) {

    const entries = await fs.readdir(currentPath, {
      withFileTypes: true,
    });

    const hasPackageJson = entries.some(
      entry =>
        entry.isFile() &&
        entry.name === "package.json"
    );

    if (hasPackageJson) {
      workspaces.push({
        name: path.basename(currentPath),
        path: currentPath,
      });

      return;
    }

    for (const entry of entries) {

      if (!entry.isDirectory()) continue;

      if (
        [
          ".git",
          "node_modules",
          "dist",
          "build",
          ".next",
          "coverage"
        ].includes(entry.name)
      ) {
        continue;
      }

      await scan(
        path.join(currentPath, entry.name)
      );
    }
  }
};