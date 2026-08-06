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
    "analysis.json",
];

export interface RepositoryTreeOptions {
    relativePath?: string;
    recursive?: boolean;
    maxDepth?: number;
}

export const buildRepositoryTree = async (
    repositoryPath: string,
    options: RepositoryTreeOptions = {}
): Promise<RepositoryNode[]> => {

    const rootPath = resolveTargetPath(
        repositoryPath,
        options.relativePath
    );

    const stats = await fs.stat(rootPath);

    if (stats.isFile()) {
        return [await buildFileNode(rootPath, repositoryPath, 0)];
    }

    return await walk(rootPath, repositoryPath, 0, options);

};

async function walk(
    currentPath: string,
    repositoryPath: string,
    depth: number,
    options: RepositoryTreeOptions
): Promise<RepositoryNode[]> {

    const entries = await fs.readdir(currentPath, {
        withFileTypes: true,
    });

    const nodes: RepositoryNode[] = [];

    for (const entry of entries) {

        if (IGNORE.includes(entry.name)) {
            continue;
        }

        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
            const children =
                options.recursive === false ||
                (options.maxDepth !== undefined && depth >= options.maxDepth)
                    ? undefined
                    : await walk(fullPath, repositoryPath, depth + 1, options);

            nodes.push({
                name: entry.name,
                path: path.relative(repositoryPath, fullPath).replace(/\\/g, "/"),
                depth,
                type: "directory",
                children,
            });
            continue;
        }

        nodes.push(
            await buildFileNode(fullPath, repositoryPath, depth)
        );
    }

    return nodes;

}

async function buildFileNode(
    filePath: string,
    repositoryPath: string,
    depth: number
): Promise<RepositoryNode> {

    const stats = await fs.stat(filePath);
    const fileName = path.basename(filePath);
    const extension = path.extname(fileName) || undefined;

    return {
        name: fileName,
        path: path.relative(repositoryPath, filePath).replace(/\\/g, "/"),
        depth,
        type: "file",
        extension,
        size: stats.size,
    };

}

function resolveTargetPath(
    repositoryPath: string,
    relativePath?: string
): string {

    if (!relativePath) {
        return repositoryPath;
    }

    const candidate = path.resolve(repositoryPath, relativePath);
    const normalizedRoot = path.resolve(repositoryPath);

    if (
        candidate !== normalizedRoot &&
        !candidate.startsWith(`${normalizedRoot}${path.sep}`)
    ) {
        return repositoryPath;
    }

    return candidate;

}
