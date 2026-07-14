import simpleGit from "simple-git";
import path from "path";
import fs from "fs/promises";
import { v4 as uuid } from "uuid";

const git = simpleGit();

export const cloneRepository = async (
  repositoryUrl: string
) => {

  const repositoryId = uuid();

  const tempDirectory = path.join(
    process.cwd(),
    "temp",
    "repositories",
    repositoryId
  );

  await fs.mkdir(tempDirectory, {
    recursive: true,
  });

  await git.clone(
    repositoryUrl,
    tempDirectory
  );

  return {
    repositoryId,
    path: tempDirectory,
  };
};