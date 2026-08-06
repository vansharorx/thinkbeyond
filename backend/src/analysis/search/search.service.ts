import { WorkspaceAnalysis } from "../../services/workspace.service";

export interface SearchResult {
    workspace: string;
    file: string;
    score: number;
}

export interface RepositorySearchHit {
    workspace: string;
    name: string;
    path: string;
    kind: string;
    score: number;
}

export interface RepositorySearchResponse {
    files: RepositorySearchHit[];
    symbols: RepositorySearchHit[];
    functions: RepositorySearchHit[];
    classes: RepositorySearchHit[];
    interfaces: RepositorySearchHit[];
    enums: RepositorySearchHit[];
    variables: RepositorySearchHit[];
    typeAliases: RepositorySearchHit[];
}

export type RepositorySearchScope =
    | "files"
    | "symbols"
    | "functions"
    | "classes"
    | "interfaces"
    | "enums"
    | "variables"
    | "typeAliases"
    | "all";

export type RepositorySearchMatchMode = "exact" | "partial";

export interface RepositorySearchOptions {
    scope?: RepositorySearchScope;
    matchMode?: RepositorySearchMatchMode;
}

export const searchRepository = (
    workspaces: WorkspaceAnalysis[],
    query: string
): SearchResult[] => {

    const results: SearchResult[] = [];

    const normalized = query.toLowerCase();

    for (const workspace of workspaces) {
        for (const file of workspace.sourceFiles) {
            if (file.relativePath.toLowerCase().includes(normalized)) {
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

export const searchRepositoryExplorer = (
    workspaces: WorkspaceAnalysis[],
    query: string,
    options: RepositorySearchOptions = {}
): RepositorySearchResponse => {
    const normalizedQuery = normalize(query);
    const matchMode = options.matchMode ?? "partial";
    const searchAll = !options.scope || options.scope === "all";
    const shouldSearch = (scope: Exclude<RepositorySearchScope, "all">) =>
        searchAll || options.scope === scope;

    const response: RepositorySearchResponse = {
        files: [],
        symbols: [],
        functions: [],
        classes: [],
        interfaces: [],
        enums: [],
        variables: [],
        typeAliases: [],
    };

    for (const workspace of workspaces) {
        for (const sourceFile of workspace.sourceFiles) {
            if (shouldSearch("files") && matches(sourceFile.relativePath, normalizedQuery, matchMode)) {
                response.files.push(buildHit(workspace.name, sourceFile.relativePath, sourceFile.relativePath, "file"));
            }

            if (shouldSearch("symbols")) {
                for (const [, symbol] of sourceFile.symbolTable) {
                    if (matches(symbol.name, normalizedQuery, matchMode)) {
                        response.symbols.push(buildHit(workspace.name, symbol.name, sourceFile.relativePath, symbol.kind));
                    }
                }
            }

            const ast = sourceFile.ast;
            if (!ast) {
                continue;
            }

            if (shouldSearch("functions")) {
                for (const fn of ast.functions) {
                    if (matches(fn.name, normalizedQuery, matchMode)) {
                        response.functions.push(buildHit(workspace.name, fn.name, sourceFile.relativePath, "function"));
                    }
                }
            }

            if (shouldSearch("classes")) {
                for (const cls of ast.classes) {
                    if (matches(cls.name, normalizedQuery, matchMode)) {
                        response.classes.push(buildHit(workspace.name, cls.name, sourceFile.relativePath, "class"));
                    }
                }
            }

            if (shouldSearch("interfaces")) {
                for (const iface of ast.interfaces) {
                    if (matches(iface.name, normalizedQuery, matchMode)) {
                        response.interfaces.push(buildHit(workspace.name, iface.name, sourceFile.relativePath, "interface"));
                    }
                }
            }

            if (shouldSearch("enums")) {
                for (const en of ast.enums) {
                    if (matches(en.name, normalizedQuery, matchMode)) {
                        response.enums.push(buildHit(workspace.name, en.name, sourceFile.relativePath, "enum"));
                    }
                }
            }

            if (shouldSearch("variables")) {
                for (const variable of ast.variables) {
                    if (matches(variable.name, normalizedQuery, matchMode)) {
                        response.variables.push(buildHit(workspace.name, variable.name, sourceFile.relativePath, "variable"));
                    }
                }
            }

            if (shouldSearch("typeAliases")) {
                for (const typeAlias of ast.typeAliases) {
                    if (matches(typeAlias.name, normalizedQuery, matchMode)) {
                        response.typeAliases.push(buildHit(workspace.name, typeAlias.name, sourceFile.relativePath, "typeAlias"));
                    }
                }
            }
        }
    }

    return response;
};

function matches(
    value: string,
    query: string,
    matchMode: RepositorySearchMatchMode
): boolean {
    const normalizedValue = normalize(value);

    if (matchMode === "exact") {
        return normalizedValue === query;
    }

    return normalizedValue.includes(query);
}

function normalize(value: string): string {
    return value.trim().toLowerCase();
}

function buildHit(
    workspace: string,
    name: string,
    path: string,
    kind: string
): RepositorySearchHit {
    return {
        workspace,
        name,
        path,
        kind,
        score: 1,
    };
}
