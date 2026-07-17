import { cloneRepository } from "./git.service";
import { scanRepository } from "./scanner.service";
import { generateManifest } from "./manifest.service";
import { analyzeReadme } from "./readme.service";
import { analyzePackage } from "./package-analyzer.service";

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

  return {
    repositoryId: repository.repositoryId,
    manifest,
    readme,
    packageAnalysis,
    scan,
  };

};