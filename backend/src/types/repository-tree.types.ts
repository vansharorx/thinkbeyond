export interface RepositoryNode {

    name: string;

    path: string;

    depth: number;

    type: "file" | "directory";

    extension?: string;

    size?: number;

    children?: RepositoryNode[];

}