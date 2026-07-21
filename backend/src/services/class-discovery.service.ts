import ts from "typescript";
import { parseTypeScriptFile } from "./ast-parser.service";

export interface ClassInfo {
    name: string;
    exported: boolean;
    abstract: boolean;
    extends: string | null;
    implements: string[];
    startLine: number;
    endLine: number;
}

export const discoverClasses = async (
    filePath: string
): Promise<ClassInfo[]> => {

    const sourceFile = await parseTypeScriptFile(filePath);

    const classes: ClassInfo[] = [];

    function visit(node: ts.Node) {

        if (
            ts.isClassDeclaration(node) &&
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

            let parentClass: string | null = null;
            const implemented: string[] = [];

            node.heritageClauses?.forEach(clause => {

                if (
                    clause.token ===
                    ts.SyntaxKind.ExtendsKeyword
                ) {

                    parentClass =
                        clause.types[0]?.expression.getText(sourceFile) ??
                        null;

                }

                if (
                    clause.token ===
                    ts.SyntaxKind.ImplementsKeyword
                ) {

                    implemented.push(
                        ...clause.types.map(type =>
                            type.expression.getText(sourceFile)
                        )
                    );

                }

            });

            classes.push({

                name: node.name.text,

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

                extends: parentClass,

                implements: implemented,

                startLine: start.line + 1,

                endLine: end.line + 1,

            });

        }

        ts.forEachChild(node, visit);

    }

    visit(sourceFile);

    return classes;

};