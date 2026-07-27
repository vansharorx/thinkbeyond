import ts from "typescript";
import type { VariableInfo } from "../types/ast.types";

export const discoverVariables = (
    sourceFile: ts.SourceFile
): VariableInfo[] => {

    const variables: VariableInfo[] = [];

    function visit(node: ts.Node) {

        if (ts.isVariableStatement(node)) {

            const exported =
                node.modifiers?.some(
                    modifier =>
                        modifier.kind ===
                        ts.SyntaxKind.ExportKeyword
                ) ?? false;

            const declarationList = node.declarationList;

            const kind =
                (declarationList.flags & ts.NodeFlags.Const)
                    ? "const"
                    : (declarationList.flags & ts.NodeFlags.Let)
                    ? "let"
                    : "var";

            for (const declaration of declarationList.declarations) {

                const start =
                    sourceFile.getLineAndCharacterOfPosition(
                        declaration.getStart()
                    );

                const end =
                    sourceFile.getLineAndCharacterOfPosition(
                        declaration.getEnd()
                    );

                variables.push({

                    name: declaration.name.getText(sourceFile),

                    kind,

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

        }

        ts.forEachChild(node, visit);

    }

    visit(sourceFile);

    return variables;

};