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