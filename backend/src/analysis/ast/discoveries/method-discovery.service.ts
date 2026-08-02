import ts from "typescript";

import type { VisitorContext } from "../visitors/visitor-context";

export const discoverMethods = (
    node: ts.Node,
    sourceFile: ts.SourceFile,
    context: VisitorContext
): void => {

    if (!ts.isMethodDeclaration(node)) {
        return;
    }

    const start =
        sourceFile.getLineAndCharacterOfPosition(
            node.getStart()
        );

    const end =
        sourceFile.getLineAndCharacterOfPosition(
            node.getEnd()
        );

    const visibility =
        node.modifiers?.some(
            modifier =>
                modifier.kind ===
                ts.SyntaxKind.PrivateKeyword
        )
            ? "private"
            : node.modifiers?.some(
                modifier =>
                    modifier.kind ===
                    ts.SyntaxKind.ProtectedKeyword
            )
            ? "protected"
            : "public";

    context.analysis.methods.push({
        name: node.name.getText(sourceFile),
        visibility,
        static:
            node.modifiers?.some(
                modifier =>
                    modifier.kind ===
                    ts.SyntaxKind.StaticKeyword
            ) ?? false,
        async:
            node.modifiers?.some(
                modifier =>
                    modifier.kind ===
                    ts.SyntaxKind.AsyncKeyword
            ) ?? false,
        abstract:
            node.modifiers?.some(
                modifier =>
                    modifier.kind ===
                    ts.SyntaxKind.AbstractKeyword
            ) ?? false,
        parameters: node.parameters.map(parameter =>
            parameter.name.getText(sourceFile)
        ),
        returnType:
            node.type?.getText(sourceFile) ?? null,
        startLine: start.line + 1,
        endLine: end.line + 1,
    });
};
