import fs from "fs/promises";
import path from "path";

export interface ReadmeAnalysis {
  exists: boolean;
  title: string | null;
  description: string | null;
  installation: string | null;
  usage: string | null;
}

export const analyzeReadme = async (
  repositoryPath: string
): Promise<ReadmeAnalysis> => {

  const readmePath = path.join(
    repositoryPath,
    "README.md"
  );

  try {

    const content = await fs.readFile(
      readmePath,
      "utf-8"
    );

    const cleanedContent = content
    .replace(/<[^>]*>/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\r/g, "");

    const lines = cleanedContent.split("\n");

    const title =
    lines.find(line => /^\s*#\s+/.test(line))
        ?.replace(/^#\s+/, "")
        .trim() || null;

    const description =
      lines.find(
        line =>
          line.trim() !== "" &&
          !line.startsWith("#")
      )?.trim() || null;

    const installation =
      extractSection(cleanedContent, "Installation");

    const usage =
      extractSection(cleanedContent, "Usage");

    return {
      exists: true,
      title,
      description,
      installation,
      usage,
    };

  } catch {

    return {
      exists: false,
      title: null,
      description: null,
      installation: null,
      usage: null,
    };

  }

};

function extractSection(
  markdown: string,
  heading: string
): string | null {

  const regex = new RegExp(
    `##\\s+${heading}([\\s\\S]*?)(\\n##|$)`,
    "i"
  );

  const match = markdown.match(regex);

  if (!match) return null;

  return match[1].trim();

}