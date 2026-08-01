export interface RepositoryNode {

    name: string;

    path: string;

    type: "file" | "directory";

    children?: RepositoryNode[];

}