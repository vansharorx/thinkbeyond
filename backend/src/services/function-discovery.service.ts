import ts from "typescript";

export interface FunctionInfo {
    name: string;
    async: boolean;
    exported: boolean;
    parameters: string[];
    returnType: string | null;
    startLine: number;
    endLine: number;
}

export const discoverFunctions = (
    sourceFile: ts.SourceFile
): FunctionInfo[] => {

    const functions: FunctionInfo[] = [];

    function visit(node: ts.Node) {

        if (
            ts.isFunctionDeclaration(node) &&
            node.name
        ) {

            const start =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getStart()
                );

            const end =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getEnd()
                );

            functions.push({

                name: node.name.text,

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

                parameters:
                    node.parameters.map(
                        parameter => parameter.name.getText(sourceFile)
                    ),

                returnType:
                    node.type?.getText(sourceFile) ?? null,

                startLine: start.line + 1,

                endLine: end.line + 1,

            });

        }

        ts.forEachChild(node, visit);

    }

    visit(sourceFile);

    return functions;

};