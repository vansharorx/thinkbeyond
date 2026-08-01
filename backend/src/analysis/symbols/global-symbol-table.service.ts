import { SourceFile } from "../../services/source-indexer.service";
import {
    SymbolInfo,
} from "./symbol-table.service";

export interface GlobalSymbolInfo extends SymbolInfo {
    file: string;
}

export const buildGlobalSymbolTable = (
    sourceFiles: SourceFile[]
): Map<string, GlobalSymbolInfo> => {

    const table = new Map<string, GlobalSymbolInfo>();

    for (const sourceFile of sourceFiles) {

        for (const [, symbol] of sourceFile.symbolTable) {

            table.set(symbol.name, {
                ...symbol,
                file: sourceFile.relativePath,
            });

        }

    }

    return table;
};