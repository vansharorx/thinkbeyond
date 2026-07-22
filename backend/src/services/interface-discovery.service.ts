import ts from "typescript";

export interface InterfaceInfo {
    name: string;
    exported: boolean;
    extends: string[];
    properties: string[];
    methods: string[];
    startLine: number;
    endLine: number;
}

export const discoverInterfaces = (
    sourceFile: ts.SourceFile
): InterfaceInfo[] => {

    const interfaces: InterfaceInfo[] = [];

    function visit(node: ts.Node) {

        if (ts.isInterfaceDeclaration(node)) {

            const start =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getStart()
                );

            const end =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getEnd()
                );

            const properties: string[] = [];
            const methods: string[] = [];

            for (const member of node.members) {

                if (
                    ts.isPropertySignature(member) &&
                    member.name
                ) {

                    properties.push(
                        member.name.getText(sourceFile)
                    );

                }

                if (
                    ts.isMethodSignature(member) &&
                    member.name
                ) {

                    methods.push(
                        member.name.getText(sourceFile)
                    );

                }

            }

            interfaces.push({

                name: node.name.text,

                exported:
                    node.modifiers?.some(
                        modifier =>
                            modifier.kind ===
                            ts.SyntaxKind.ExportKeyword
                    ) ?? false,

                extends:
                    node.heritageClauses
                        ?.flatMap(clause =>
                            clause.types.map(type =>
                                type.expression.getText(sourceFile)
                            )
                        ) ?? [],

                properties,

                methods,

                startLine: start.line + 1,

                endLine: end.line + 1,

            });

        }

        ts.forEachChild(node, visit);

    }

    visit(sourceFile);

    return interfaces;

};