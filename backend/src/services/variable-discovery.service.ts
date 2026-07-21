import ts from "typescript";
import { parseTypeScriptFile } from "./ast-parser.service";

export interface VariableInfo {
    name: string;
    kind: "const" | "let" | "var";
    exported: boolean;
    type: string | null;
    initializer: string | null;
    startLine: number;
    endLine: number;
}

export const discoverVariables = async (
    filePath: string
): Promise<VariableInfo[]> => {

    const sourceFile = await parseTypeScriptFile(filePath);

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