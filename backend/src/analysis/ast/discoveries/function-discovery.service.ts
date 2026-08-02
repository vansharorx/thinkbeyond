import ts from "typescript";

import type { VisitorContext } from "../visitors/visitor-context";

export const discoverFunctions = (
    node: ts.Node,
    sourceFile: ts.SourceFile,
    context: VisitorContext
): void => {

    if (!ts.isFunctionDeclaration(node)) {
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

    context.analysis.functions.push({
        name: node.name?.text ?? "anonymous",
        async:
            node.modifiers?.some(
                modifier =>
                    modifier.kind ===
                    ts.SyntaxKind.AsyncKeyword
            ) ?? false,
        exported:
            node.modifiers?.some(
                modifier =>
                    modifier.kind ===
                    ts.SyntaxKind.ExportKeyword
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
