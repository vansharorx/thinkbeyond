import simpleGit from "simple-git";
import fs from "fs/promises";
import { ensureRepositoryRootPath } from "./repository-explorer-state.service";

const git = simpleGit();

export const cloneRepository = async (
  repositoryId: string,
  repositoryUrl: string,
  targetPath?: string
) => {
  const tempDirectory = targetPath ?? await ensureRepositoryRootPath(repositoryId, true);
  await fs.mkdir(tempDirectory, { recursive: true });

  await git.clone(
    repositoryUrl,
    tempDirectory
  );

  return {
    repositoryId,
    path: tempDirectory,
  };
};