import type { ASTAnalysis } from "../types/ast.types";

export interface SymbolInfo {
    name: string;

    kind:
        | "function"
        | "class"
        | "method"
        | "interface"
        | "enum"
        | "typeAlias"
        | "variable";

    exported: boolean;

    startLine: number;
    endLine: number;
}

export const buildSymbolTable = (
    ast: ASTAnalysis
): Map<string, SymbolInfo> => {

    const table = new Map<string, SymbolInfo>();

    ast.functions.forEach(fn =>
        table.set(fn.name, {
            name: fn.name,
            kind: "function",
            exported: fn.exported,
            startLine: fn.startLine,
            endLine: fn.endLine,
        })
    );

    ast.classes.forEach(cls =>
        table.set(cls.name, {
            name: cls.name,
            kind: "class",
            exported: cls.exported,
            startLine: cls.startLine,
            endLine: cls.endLine,
        })
    );

    ast.methods.forEach(method =>
        table.set(method.name, {
            name: method.name,
            kind: "method",
            exported: false,
            startLine: method.startLine,
            endLine: method.endLine,
        })
    );

    ast.interfaces.forEach(i =>
        table.set(i.name, {
            name: i.name,
            kind: "interface",
            exported: i.exported,
            startLine: i.startLine,
            endLine: i.endLine,
        })
    );

    ast.enums.forEach(e =>
        table.set(e.name, {
            name: e.name,
            kind: "enum",
            exported: e.exported,
            startLine: e.startLine,
            endLine: e.endLine,
        })
    );

    ast.typeAliases.forEach(type =>
        table.set(type.name, {
            name: type.name,
            kind: "typeAlias",
            exported: type.exported,
            startLine: type.startLine,
            endLine: type.endLine,
        })
    );

    ast.variables.forEach(variable =>
        table.set(variable.name, {
            name: variable.name,
            kind: "variable",
            exported: variable.exported,
            startLine: variable.startLine,
            endLine: variable.endLine,
        })
    );

    return table;
};