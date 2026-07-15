import { cloneRepository } from "./git.service";
import { scanRepository } from "./scanner.service";

export const importRepositoryService = async (
  url: string
) => {

  const repository =
    await cloneRepository(url);

  const manifest =
    await scanRepository(repository.path);

  return {
    repositoryId: repository.repositoryId,
    ...manifest,
  };

};