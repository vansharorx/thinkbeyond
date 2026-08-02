import ts from "typescript";

import type { VisitorContext } from "../visitors/visitor-context";

export const discoverClasses = (
    node: ts.Node,
    sourceFile: ts.SourceFile,
    context: VisitorContext
): void => {

    if (!ts.isClassDeclaration(node)) {
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

    const extendsClause =
        node.heritageClauses?.find(
            clause =>
                clause.token ===
                ts.SyntaxKind.ExtendsKeyword
        );

    const implementsClause =
        node.heritageClauses?.find(
            clause =>
                clause.token ===
                ts.SyntaxKind.ImplementsKeyword
        );

    context.analysis.classes.push({
        name: node.name?.text ?? "anonymous",
        exported:
            node.modifiers?.some(
                modifier =>
                    modifier.kind ===
                    ts.SyntaxKind.ExportKeyword
            ) ?? false,
        abstract:
            node.modifiers?.some(
                modifier =>
                    modifier.kind ===
                    ts.SyntaxKind.AbstractKeyword
            ) ?? false,
        extends:
            extendsClause?.types[0]?.expression.getText(sourceFile) ??
            null,
        implements:
            implementsClause?.types.map(type =>
                type.expression.getText(sourceFile)
            ) ?? [],
        startLine: start.line + 1,
        endLine: end.line + 1,
    });
};
