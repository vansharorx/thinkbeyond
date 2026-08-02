import ts from "typescript";

import type { VisitorContext } from "../visitors/visitor-context";

export const discoverVariables = (
    node: ts.Node,
    sourceFile: ts.SourceFile,
    context: VisitorContext
): void => {

    if (!ts.isVariableStatement(node)) {
        return;
    }

    const exported =
        node.modifiers?.some(
            modifier =>
                modifier.kind ===
                ts.SyntaxKind.ExportKeyword
        ) ?? false;

    const declarationKind =
        node.declarationList.flags &
        ts.NodeFlags.Const
            ? "const"
            : node.declarationList.flags &
              ts.NodeFlags.Let
            ? "let"
            : "var";

    for (const declaration of node.declarationList.declarations) {

        const start =
            sourceFile.getLineAndCharacterOfPosition(
                declaration.getStart()
            );

        const end =
            sourceFile.getLineAndCharacterOfPosition(
                declaration.getEnd()
            );

        context.analysis.variables.push({
            name: declaration.name.getText(sourceFile),
            kind: declarationKind,
            exported,
            type:
                declaration.type?.getText(sourceFile) ??
                null,
            initializer:
                declaration.initializer?.getText(sourceFile) ??
                null,
            startLine: start.line + 1,
            endLine: end.line + 1,
        });
    }
};
