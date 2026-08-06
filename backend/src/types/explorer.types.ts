export interface ExplorerFile {

    path: string;

    imports: number;

    exports: number;

    symbols: number;

}

export interface ExplorerWorkspace {

    name: string;

    files: ExplorerFile[];

}

export interface ExplorerResponse {

    workspaces: ExplorerWorkspace[];

}

export interface ExplorerTreeResponse {
    repositoryId: string;
    path: string;
    tree: import("./repository-tree.types").RepositoryNode[];
}

export interface RepositoryFileResponse {
    repositoryId: string;
    workspace: string;
    path: string;
    file: unknown;
}

export interface ExplorerFileResponse {
    repositoryId: string;
    path: string;
    file: unknown;
}

export interface ExplorerSymbolResponse {
    repositoryId: string;
    symbol: unknown;
}

export interface ExplorerOverviewResponse {
    repositoryId: string;
    overview: unknown;
}

export interface ExplorerSearchResponse {
    repositoryId: string;
    query: string;
    results: unknown;
}