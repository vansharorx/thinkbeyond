import { WorkspaceAnalysis } from "../../services/workspace.service";
import { GlobalSymbolInfo } from "../symbols/global-symbol-table.service";

export interface SymbolSearchResult {

    workspace: string;

    symbol: GlobalSymbolInfo;

}

export const searchSymbols = (
    workspaces: WorkspaceAnalysis[],
    query: string
): SymbolSearchResult[] => {

    const results: SymbolSearchResult[] = [];

    const normalized =
        query.toLowerCase();

    for (const workspace of workspaces) {

        for (
            const [, symbol]
            of workspace.globalSymbolTable
        ) {

            if (
                symbol.name
                    .toLowerCase()
                    .includes(normalized)
            ) {

                results.push({

                    workspace: workspace.name,

                    symbol,

                });

            }

        }

    }

    return results;

};