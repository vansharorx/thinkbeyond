import { FileContext } from "./file-context.service";

export interface PromptOptions {
    task: string;
    file: FileContext;
}

export const buildPrompt = (
    options: PromptOptions
): string => {

    return `
Task:
${options.task}

File:
${options.file.path}

Imports:
${options.file.imports.join("\n") || "None"}

Exports:
${options.file.exports.join("\n") || "None"}

Symbols:
${options.file.symbols.join("\n") || "None"}
`.trim();

};