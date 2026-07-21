import ts from "typescript";
import { parseTypeScriptFile } from "./ast-parser.service";

export interface TypeAliasInfo {
    name: string;
    exported: boolean;
    generics: string[];
    definition: string;
    startLine: number;
    endLine: number;
}

export const discoverTypeAliases = async (
    filePath: string
): Promise<TypeAliasInfo[]> => {

    const sourceFile = await parseTypeScriptFile(filePath);

    const aliases: TypeAliasInfo[] = [];

    function visit(node: ts.Node) {

        if (ts.isTypeAliasDeclaration(node)) {

            const start =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getStart()
                );

            const end =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getEnd()
                );

            aliases.push({

                name: node.name.text,

                exported:
                    node.modifiers?.some(
                        modifier =>
                            modifier.kind ===
                            ts.SyntaxKind.ExportKeyword
                    ) ?? false,

                generics:
                    node.typeParameters?.map(parameter =>
                        parameter.name.text
                    ) ?? [],

                definition:
                    node.type.getText(sourceFile),

                startLine: start.line + 1,

                endLine: end.line + 1,

            });

        }

        ts.forEachChild(node, visit);

    }

    visit(sourceFile);

    return aliases;

};