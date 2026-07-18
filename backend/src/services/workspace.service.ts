import fs from "fs/promises";
import path from "path";

import { generateManifest } from "./manifest.service";
import { analyzeReadme } from "./readme.service";
import { analyzePackage } from "./package-analyzer.service";
import { detectArchitecture } from "./architecture.service";

export interface WorkspaceAnalysis {
  name: string;
  relativePath: string;

  manifest: Awaited<ReturnType<typeof generateManifest>>;
  readme: Awaited<ReturnType<typeof analyzeReadme>>;
  packageAnalysis: Awaited<ReturnType<typeof analyzePackage>>;
  architecture: Awaited<ReturnType<typeof detectArchitecture>>;
}

export const analyzeWorkspaces = async (
  repositoryPath: string,
  directories: string[]
): Promise<WorkspaceAnalysis[]> => {

  const workspacePaths = await detectWorkspacePaths(repositoryPath);

  const analyses: WorkspaceAnalysis[] = [];

  for (const workspace of workspacePaths) {

    analyses.push({
      name: workspace.name,
      relativePath: workspace.relativePath,

      manifest: await generateManifest(workspace.path),

      readme: await analyzeReadme(workspace.path),

      packageAnalysis: await analyzePackage(workspace.path),

      architecture: await detectArchitecture(
        workspace.path,
        directories
      ),
    });

  }

  return analyses;
};

interface WorkspacePath {
  name: string;
  path: string;
  relativePath: string;
}

async function detectWorkspacePaths(
  repositoryPath: string
): Promise<WorkspacePath[]> {

  const workspaces: WorkspacePath[] = [];

  await scan(repositoryPath);

  if (workspaces.length === 0) {

    workspaces.push({
      name: path.basename(repositoryPath),
      path: repositoryPath,
      relativePath: ".",
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
        relativePath: path.relative(
          repositoryPath,
          currentPath
        ),
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

}