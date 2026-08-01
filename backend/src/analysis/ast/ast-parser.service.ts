import fs from "fs/promises";
import ts from "typescript";

export const parseTypeScriptFile = async (
    filePath: string
) => {

    const source = await fs.readFile(
        filePath,
        "utf-8"
    );

    const sourceFile =
        ts.createSourceFile(
            filePath,
            source,
            ts.ScriptTarget.Latest,
            true
        );

    return sourceFile;

};
