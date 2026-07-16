import fs from "fs/promises";
import path from "path";

interface RepositoryManifest {
  name: string;
  packageManager: string | null;
  framework: string | null;
  language: string;
  typescript: boolean;
  docker: boolean;
  ci: boolean;
  entryPoints: string[];
}

export const generateManifest = async (
  repositoryPath: string
): Promise<RepositoryManifest> => {

  const manifest: RepositoryManifest = {
    name: path.basename(repositoryPath),
    packageManager: null,
    framework: null,
    language: "Unknown",
    typescript: false,
    docker: false,
    ci: false,
    entryPoints: [],
  };

  try {

    const packageJsonPath = path.join(
      repositoryPath,
      "package.json"
    );

    const packageJson = JSON.parse(
      await fs.readFile(packageJsonPath, "utf-8")
    );
    

    manifest.name =
      packageJson.name || manifest.name;

    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (packageJson.name === "express")
    manifest.framework = "Express";

    else if ("express" in dependencies)
    manifest.framework = "Express";

    else if ("next" in dependencies)
    manifest.framework = "Next.js";

    else if ("react" in dependencies)
    manifest.framework = "React";

    else if ("vue" in dependencies)
    manifest.framework = "Vue";

    else if ("@nestjs/core" in dependencies)
    manifest.framework = "NestJS";

    if ("typescript" in dependencies) {
      manifest.typescript = true;
      manifest.language = "TypeScript";
    } else {
      manifest.language = "JavaScript";
    }

    if (packageJson.packageManager) {

    manifest.packageManager =
        packageJson.packageManager.split("@")[0];

    } else if (await exists(path.join(repositoryPath, "package-lock.json"))) {

    manifest.packageManager = "npm";

    } else if (await exists(path.join(repositoryPath, "pnpm-lock.yaml"))) {

    manifest.packageManager = "pnpm";

    } else if (await exists(path.join(repositoryPath, "yarn.lock"))) {

    manifest.packageManager = "yarn";

    }

    if (packageJson.main)
      manifest.entryPoints.push(packageJson.main);

  } catch {}

  manifest.docker =
    await exists(path.join(repositoryPath, "Dockerfile"));

  manifest.ci =
    await exists(
      path.join(
        repositoryPath,
        ".github",
        "workflows"
      )
    );

  return manifest;
};

async function exists(file: string) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}