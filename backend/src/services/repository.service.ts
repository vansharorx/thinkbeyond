import { cloneRepository } from "./git.service";
import { scanRepository } from "./scanner.service";
import { generateManifest } from "./manifest.service";
import { analyzeReadme } from "./readme.service";
import { analyzePackage } from "./package-analyzer.service";
import { detectArchitecture } from "./architecture.service";
import { analyzeWorkspaces } from "./workspace.service";
import { generateRepositorySummary } from "./repository-summary.service";

export const importRepositoryService = async (
  url: string
) => {

  const repository =
    await cloneRepository(url);

  const scan =
  await scanRepository(repository.path);

  const manifest =
    await generateManifest(repository.path);

  const readme =
  await analyzeReadme(repository.path);

  const packageAnalysis =
    await analyzePackage(repository.path);

  const architecture =
    await detectArchitecture(
      repository.path,
      scan.directories
    );

  const workspaces =
    await analyzeWorkspaces(repository.path, scan.directories);

  const summary =
    generateRepositorySummary(workspaces);
    
  return {
    repositoryId: repository.repositoryId,
    summary,
    workspaces,
    scan
  };

};