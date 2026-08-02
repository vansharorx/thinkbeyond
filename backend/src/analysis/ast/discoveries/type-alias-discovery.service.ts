import ts from "typescript";

import type { VisitorContext } from "../visitors/visitor-context";

export const discoverTypeAliases = (
    node: ts.Node,
    sourceFile: ts.SourceFile,
    context: VisitorContext
): void => {

    if (!ts.isTypeAliasDeclaration(node)) {
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

    context.analysis.typeAliases.push({
        name: node.name.text,
        exported:
            node.modifiers?.some(
                modifier =>
                    modifier.kind ===
                    ts.SyntaxKind.ExportKeyword
            ) ?? false,
        generics:
            node.typeParameters?.map(
                parameter => parameter.name.text
            ) ?? [],
        definition: node.type.getText(sourceFile),
        startLine: start.line + 1,
        endLine: end.line + 1,
    });
};
