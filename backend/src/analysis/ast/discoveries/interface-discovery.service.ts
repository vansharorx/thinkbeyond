import ts from "typescript";

import type { VisitorContext } from "../visitors/visitor-context";

export const discoverInterfaces = (
    node: ts.Node,
    sourceFile: ts.SourceFile,
    context: VisitorContext
): void => {

    if (!ts.isInterfaceDeclaration(node)) {
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

    const extendsTypes =
        node.heritageClauses
            ?.filter(
                clause =>
                    clause.token ===
                    ts.SyntaxKind.ExtendsKeyword
            )
            .flatMap(
                clause =>
                    clause.types.map(type =>
                        type.expression.getText(sourceFile)
                    )
            ) ?? [];

    const properties =
        node.members
            .filter(ts.isPropertySignature)
            .map(member =>
                member.name.getText(sourceFile)
            );

    const methods =
        node.members
            .filter(ts.isMethodSignature)
            .map(member =>
                member.name.getText(sourceFile)
            );

    context.analysis.interfaces.push({
        name: node.name.text,
        exported:
            node.modifiers?.some(
                modifier =>
                    modifier.kind ===
                    ts.SyntaxKind.ExportKeyword
            ) ?? false,
        extends: extendsTypes,
        properties,
        methods,
        startLine: start.line + 1,
        endLine: end.line + 1,
    });
};
