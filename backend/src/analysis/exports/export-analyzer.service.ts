import fs from "fs/promises";

export interface ExportInfo {
  name: string;
  type: "default" | "named";
}

export const analyzeExports = async (
  filePath: string
): Promise<ExportInfo[]> => {

  const content = await fs.readFile(filePath, "utf-8");

  const exports: ExportInfo[] = [];

  const namedRegex =
    /export\s+(?:const|class|function|interface|type|enum)\s+([A-Za-z0-9_]+)/g;

  const defaultRegex =
    /export\s+default\s+([A-Za-z0-9_]+)/g;

  let match: RegExpExecArray | null;

  while ((match = namedRegex.exec(content)) !== null) {
    exports.push({
      name: match[1],
      type: "named",
    });
  }

  while ((match = defaultRegex.exec(content)) !== null) {
    exports.push({
      name: match[1],
      type: "default",
    });
  }

  return exports;

};