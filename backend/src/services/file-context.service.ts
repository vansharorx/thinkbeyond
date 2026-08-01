import { SourceFile } from "./source-indexer.service";

export interface FileContext {

    path: string;

    imports: string[];

    exports: string[];

    symbols: string[];

}

export const buildFileContext = (
    file: SourceFile
): FileContext => {

    return {

        path: file.relativePath,

        imports:
            file.imports.map(
                i => i.module
            ),

        exports:
            file.exports.map(
                e => e.name
            ),

        symbols:
            [...file.symbolTable.keys()],

    };

};