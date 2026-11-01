import { queueRepositoryImport } from "./repository-lifecycle.service";

export const importRepositoryService = async (
  url: unknown,
  ownerId: string
) => {
  return queueRepositoryImport(url, ownerId);
};