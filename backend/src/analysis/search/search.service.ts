import { WorkspaceAnalysis } from "../../services/workspace.service";

export interface SearchResult {
    workspace: string;
    file: string;
    score: number;
}

export const searchRepository = (
    workspaces: WorkspaceAnalysis[],
    query: string
): SearchResult[] => {

    const results: SearchResult[] = [];

    const normalized =
        query.toLowerCase();

    for (const workspace of workspaces) {

        for (const file of workspace.sourceFiles) {

            if (
                file.relativePath
                    .toLowerCase()
                    .includes(normalized)
            ) {

                results.push({

                    workspace: workspace.name,

                    file: file.relativePath,

                    score: 1,

                });

            }

        }

    }

    return results;

};