import ts from "typescript";

import type { VisitorContext } from "../visitors/visitor-context";

export const discoverEnums = (
    node: ts.Node,
    sourceFile: ts.SourceFile,
    context: VisitorContext
): void => {

    if (!ts.isEnumDeclaration(node)) {
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

    const members =
        node.members.map(member =>
            member.name.getText(sourceFile)
        );

    context.analysis.enums.push({
        name: node.name.text,
        exported:
            node.modifiers?.some(
                modifier =>
                    modifier.kind ===
                    ts.SyntaxKind.ExportKeyword
            ) ?? false,
        const:
            node.modifiers?.some(
                modifier =>
                    modifier.kind ===
                    ts.SyntaxKind.ConstKeyword
            ) ?? false,
        members,
        startLine: start.line + 1,
        endLine: end.line + 1,
    });
};
