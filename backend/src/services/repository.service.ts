import { cloneRepository } from "./git.service";

export const importRepositoryService = async (
  url: string
) => {
  return cloneRepository(url);
};