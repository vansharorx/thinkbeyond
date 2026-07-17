import fs from "fs/promises";
import path from "path";

export interface ArchitectureAnalysis {
  architecture: string;
  patterns: string[];
}

export const detectArchitecture = async (
  repositoryPath: string,
  directories: string[]
): Promise<ArchitectureAnalysis> => {

  const patterns: string[] = [];

  const has = (name: string) =>
    directories.some(dir =>
      dir.toLowerCase().includes(name)
    );

  if (
    has("controllers") &&
    has("models") &&
    has("views")
  ) {
    patterns.push("MVC");
  }

  if (
    has("controllers") &&
    has("services") &&
    has("repositories")
  ) {
    patterns.push("Layered Architecture");
  }

  if (
    has("domain") &&
    has("application") &&
    has("infrastructure")
  ) {
    patterns.push("Clean Architecture");
  }

  if (
    await exists(path.join(repositoryPath, "apps")) &&
    await exists(path.join(repositoryPath, "packages"))
  ) {
    patterns.push("Monorepo");
  }

  return {
    architecture:
      patterns[0] || "Unknown",
    patterns,
  };

};

async function exists(file: string) {

  try {

    await fs.access(file);

    return true;

  } catch {

    return false;

  }

}