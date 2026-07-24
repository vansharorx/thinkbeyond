import ts from "typescript";
import { ASTAnalysis } from "./ast-analysis.service";

export const visitAST = (
    sourceFile: ts.SourceFile
): ASTAnalysis => {

    const analysis: ASTAnalysis = {

        functions: [],
        classes: [],
        methods: [],
        interfaces: [],
        enums: [],
        typeAliases: [],
        variables: [],

    };

    function visit(
        node: ts.Node
    ) {

        if (ts.isFunctionDeclaration(node)) {

        const start =
            sourceFile.getLineAndCharacterOfPosition(
                node.getStart()
            );

        const end =
            sourceFile.getLineAndCharacterOfPosition(
                node.getEnd()
            );

        analysis.functions.push({

            name:
                node.name?.text ?? "anonymous",

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
                node.parameters.map(parameter =>
                    parameter.name.getText(sourceFile)
                ),

            returnType:
                node.type?.getText(sourceFile) ??
                null,

            startLine:
                start.line + 1,

            endLine:
                end.line + 1,

        });

    }

        ts.forEachChild(
            node,
            visit
        );

    }

    visit(sourceFile);

    return analysis;

};