import fs from "fs/promises";
import path from "path";

import { RepositoryNode } from "../types/repository-tree.types";

const IGNORE = [
    ".git",
    "node_modules",
    "dist",
    "build",
    ".next",
    "coverage",
];

export const buildRepositoryTree = async (
    repositoryPath: string
): Promise<RepositoryNode[]> => {

    return await walk(repositoryPath);

};

async function walk(
    currentPath: string
): Promise<RepositoryNode[]> {

    const entries = await fs.readdir(
        currentPath,
        {
            withFileTypes: true,
        }
    );

    const nodes: RepositoryNode[] = [];

    for (const entry of entries) {

        if (IGNORE.includes(entry.name)) {
            continue;
        }

        const fullPath =
            path.join(currentPath, entry.name);

        if (entry.isDirectory()) {

            nodes.push({

                name: entry.name,

                path: fullPath,

                type: "directory",

                children:
                    await walk(fullPath),

            });

        } else {

            nodes.push({

                name: entry.name,

                path: fullPath,

                type: "file",

            });

        }

    }

    return nodes;

}