import { SourceFile } from "./source-indexer.service";
import { GlobalSymbolInfo } from "./global-symbol-table.service";

export interface ResolvedImport {
    importName: string;
    resolved: GlobalSymbolInfo | null;
}

export const resolveImports = (
    sourceFile: SourceFile,
    globalSymbols: Map<string, GlobalSymbolInfo>
): ResolvedImport[] => {

    const resolved: ResolvedImport[] = [];

    for (const fileImport of sourceFile.imports) {

        if (fileImport.type !== "internal") {
            continue;
        }

        const importName =
            fileImport.module.split("/").pop() ?? fileImport.module;

        resolved.push({
            importName,
            resolved:
                globalSymbols.get(importName) ?? null,
        });

    }

    return resolved;

};