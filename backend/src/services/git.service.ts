import simpleGit from "simple-git";
import { v4 as uuid } from "uuid";
import { ensureRepositoryRootPath } from "./repository-explorer-state.service";

const git = simpleGit();

export const cloneRepository = async (
  repositoryUrl: string
) => {

  const repositoryId = uuid();

  const tempDirectory = await ensureRepositoryRootPath(repositoryId, true);

  await git.clone(
    repositoryUrl,
    tempDirectory
  );

  return {
    repositoryId,
    path: tempDirectory,
  };
};