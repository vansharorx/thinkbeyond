import fs from "fs/promises";

export interface ImportInfo {
  module: string;
  type: "internal" | "external";
}

export const analyzeImports = async (
  filePath: string
): Promise<ImportInfo[]> => {

  const content = await fs.readFile(filePath, "utf-8");

  // Map removes duplicate imports automatically
  const importsMap = new Map<string, ImportInfo>();

  const regex =
    /import[\s\S]*?from\s+["'](.+?)["']/g;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {

    const module = match[1];

    importsMap.set(module, {
      module,
      type: module.startsWith(".")
        ? "internal"
        : "external",
    });

  }

  // Return unique imports
  return [...importsMap.values()];

};