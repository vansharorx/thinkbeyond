import { WorkspaceAnalysis } from "./workspace.service";

export interface FolderSummary {

    folder: string;

    files: number;

}

export interface RepositoryMap {

    workspaces: {

        name: string;

        folders: FolderSummary[];

    }[];

}

export const buildRepositoryMap = (
    workspaces: WorkspaceAnalysis[]
): RepositoryMap => {

    const repositoryMap: RepositoryMap = {

        workspaces: [],

    };

    for (const workspace of workspaces) {

        const folders = new Map<string, number>();

        for (const file of workspace.sourceFiles) {

            const folder =
                file.relativePath.split("/")[0];

            folders.set(
                folder,
                (folders.get(folder) ?? 0) + 1
            );

        }

        repositoryMap.workspaces.push({

            name: workspace.name,

            folders:
                [...folders.entries()].map(
                    ([folder, files]) => ({

                        folder,

                        files,

                    })
                ),

        });

    }

    return repositoryMap;
};