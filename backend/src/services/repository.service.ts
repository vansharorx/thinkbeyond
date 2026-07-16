import { cloneRepository } from "./git.service";
import { scanRepository } from "./scanner.service";
import { generateManifest } from "./manifest.service";

export const importRepositoryService = async (
  url: string
) => {

  const repository =
    await cloneRepository(url);

  const scan =
  await scanRepository(repository.path);

  const manifest =
    await generateManifest(repository.path);

  return {
    repositoryId: repository.repositoryId,
    manifest,
    scan,
  };

};