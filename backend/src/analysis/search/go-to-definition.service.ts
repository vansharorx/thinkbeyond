import { WorkspaceAnalysis } from "../../services/workspace.service";
import { GlobalSymbolInfo } from "../symbols/global-symbol-table.service";

export interface DefinitionResult {

    workspace: string;

    definition: GlobalSymbolInfo;

}

export const goToDefinition = (
    workspaces: WorkspaceAnalysis[],
    symbolName: string
): DefinitionResult | null => {

    for (const workspace of workspaces) {

        const symbol =
            workspace.globalSymbolTable.get(symbolName);

        if (symbol) {

            return {

                workspace: workspace.name,

                definition: symbol,

            };

        }

    }

    return null;

};