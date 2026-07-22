import ts from "typescript";

export interface EnumInfo {
    name: string;
    exported: boolean;
    const: boolean;
    members: string[];
    startLine: number;
    endLine: number;
}

export const discoverEnums = (
    sourceFile: ts.SourceFile
): EnumInfo[] => {

    const enums: EnumInfo[] = [];

    function visit(node: ts.Node) {

        if (ts.isEnumDeclaration(node)) {

            const start =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getStart()
                );

            const end =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getEnd()
                );

            enums.push({

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

                members:
                    node.members.map(member =>
                        member.name.getText(sourceFile)
                    ),

                startLine: start.line + 1,

                endLine: end.line + 1,

            });

        }

        ts.forEachChild(node, visit);

    }

    visit(sourceFile);

    return enums;

};