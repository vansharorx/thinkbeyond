import { WorkspaceAnalysis } from "./workspace.service";
import { ExplorerResponse } from "../types/explorer.types";

export const buildExplorer = (
    workspaces: WorkspaceAnalysis[]
): ExplorerResponse => {

    return {

        workspaces: [],

    };

};