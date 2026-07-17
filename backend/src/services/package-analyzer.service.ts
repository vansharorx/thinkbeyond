import fs from "fs/promises";
import path from "path";

export interface PackageAnalysis {
  runtime: string | null;
  packageManager: string | null;
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  technologies: string[];
}

const TECHNOLOGIES: Record<string, string> = {
  express: "Express",
  react: "React",
  next: "Next.js",
  vue: "Vue",
  "@nestjs/core": "NestJS",
  prisma: "Prisma",
  mongoose: "Mongoose",
  mysql2: "MySQL",
  pg: "PostgreSQL",
  mongodb: "MongoDB",
  redis: "Redis",
  typescript: "TypeScript",
  vite: "Vite",
  jest: "Jest",
  mocha: "Mocha",
  eslint: "ESLint",
  prettier: "Prettier",
};

export const analyzePackage = async (
  repositoryPath: string
): Promise<PackageAnalysis | null> => {

  const packagePath = path.join(
    repositoryPath,
    "package.json"
  );

  try {

    const packageJson = JSON.parse(
      await fs.readFile(packagePath, "utf-8")
    );

    const dependencies = Object.keys(
      packageJson.dependencies || {}
    );

    const devDependencies = Object.keys(
      packageJson.devDependencies || {}
    );

    const allPackages = [
      ...dependencies,
      ...devDependencies,
    ];

    const technologies = allPackages
      .filter(pkg => TECHNOLOGIES[pkg])
      .map(pkg => TECHNOLOGIES[pkg]);

    return {
      runtime: "Node.js",
      packageManager:
        packageJson.packageManager?.split("@")[0] || null,
      dependencies,
      devDependencies,
      scripts: packageJson.scripts || {},
      technologies,
    };

  } catch {

    return null;

  }

};