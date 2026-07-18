import { WorkspaceAnalysis } from "./workspace.service";

export interface RepositorySummary {
  workspaceCount: number;
  monorepo: boolean;

  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  technologies: string[];
}

export const generateRepositorySummary = (
  workspaces: WorkspaceAnalysis[]
): RepositorySummary => {

  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const packageManagers = new Set<string>();
  const technologies = new Set<string>();

  for (const workspace of workspaces) {

    if (workspace.manifest.language !== "Unknown") {
      languages.add(workspace.manifest.language);
    }

    if (workspace.manifest.framework) {
      frameworks.add(workspace.manifest.framework);
    }

    if (workspace.manifest.packageManager) {
      packageManagers.add(
        workspace.manifest.packageManager
      );
    }

    workspace.packageAnalysis?.technologies.forEach(
      tech => technologies.add(tech)
    );

  }

  return {
    workspaceCount: workspaces.length,

    monorepo: workspaces.length > 1,

    languages: [...languages],

    frameworks: [...frameworks],

    packageManagers: [...packageManagers],

    technologies: [...technologies],
  };

};