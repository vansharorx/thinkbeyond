import { WorkspaceAnalysis } from "./workspace.service";

export interface RepositoryKnowledge {

    workspaces: WorkspaceAnalysis[];

    statistics: {

        totalFiles: number;

        totalSymbols: number;

        totalDependencies: number;

        totalCircularDependencies: number;

    };

}

export const buildRepositoryKnowledge = (
    workspaces: WorkspaceAnalysis[]
): RepositoryKnowledge => {

    let totalFiles = 0;

    let totalSymbols = 0;

    let totalDependencies = 0;

    let totalCircularDependencies = 0;

    for (const workspace of workspaces) {

        totalFiles += workspace.sourceFiles.length;

        totalDependencies +=
            workspace.dependencyGraph.nodes.length;

        totalCircularDependencies +=
            workspace.circularDependencies.cycles.length;

        for (const sourceFile of workspace.sourceFiles) {

            totalSymbols +=
                sourceFile.symbolTable.size;

        }

    }

    return {

        workspaces,

        statistics: {

            totalFiles,

            totalSymbols,

            totalDependencies,

            totalCircularDependencies,

        },

    };

};