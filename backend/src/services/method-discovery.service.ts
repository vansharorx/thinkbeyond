import ts from "typescript";

export interface MethodInfo {

    name: string;

    visibility: "public" | "protected" | "private";

    static: boolean;

    async: boolean;

    abstract: boolean;

    parameters: string[];

    returnType: string | null;

    startLine: number;

    endLine: number;

}

export const discoverMethods = (

    sourceFile: ts.SourceFile

): MethodInfo[] => {

    const methods: MethodInfo[] = [];

    function visit(node: ts.Node) {

        if (ts.isMethodDeclaration(node)) {

            const start =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getStart()
                );

            const end =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getEnd()
                );

            methods.push({

                name:
                    node.name.getText(sourceFile),

                visibility:
                    node.modifiers?.some(
                        modifier =>
                            modifier.kind === ts.SyntaxKind.PrivateKeyword
                    )
                        ? "private"
                        : node.modifiers?.some(
                              modifier =>
                                  modifier.kind === ts.SyntaxKind.ProtectedKeyword
                          )
                        ? "protected"
                        : "public",

                static:
                    node.modifiers?.some(
                        modifier =>
                            modifier.kind === ts.SyntaxKind.StaticKeyword
                    ) ?? false,

                async:
                    node.modifiers?.some(
                        modifier =>
                            modifier.kind === ts.SyntaxKind.AsyncKeyword
                    ) ?? false,

                abstract:
                    node.modifiers?.some(
                        modifier =>
                            modifier.kind === ts.SyntaxKind.AbstractKeyword
                    ) ?? false,

                parameters:
                    node.parameters.map(parameter =>
                        parameter.name.getText(sourceFile)
                    ),

                returnType:
                    node.type?.getText(sourceFile) ?? null,

                startLine:
                    start.line + 1,

                endLine:
                    end.line + 1,

            });

        }

        ts.forEachChild(node, visit);

    }

    visit(sourceFile);

    return methods;

};