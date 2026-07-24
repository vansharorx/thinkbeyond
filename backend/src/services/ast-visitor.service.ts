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

        if (ts.isClassDeclaration(node)) {

            const start =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getStart()
                );

            const end =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getEnd()
                );

            const extendsClause =
                node.heritageClauses?.find(
                    clause =>
                        clause.token ===
                        ts.SyntaxKind.ExtendsKeyword
                );

            const implementsClause =
                node.heritageClauses?.find(
                    clause =>
                        clause.token ===
                        ts.SyntaxKind.ImplementsKeyword
                );

            analysis.classes.push({

                name:
                    node.name?.text ?? "anonymous",

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

                extends:
                    extendsClause?.types[0]
                        ?.expression.getText(sourceFile) ??
                    null,

                implements:
                    implementsClause?.types.map(
                        type =>
                            type.expression.getText(sourceFile)
                    ) ?? [],

                startLine:
                    start.line + 1,

                endLine:
                    end.line + 1,

            });

        }

        if (ts.isMethodDeclaration(node)) {

            const start =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getStart()
                );

            const end =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getEnd()
                );

            const visibility =
                node.modifiers?.some(
                    modifier =>
                        modifier.kind ===
                        ts.SyntaxKind.PrivateKeyword
                )
                    ? "private"
                    : node.modifiers?.some(
                        modifier =>
                            modifier.kind ===
                            ts.SyntaxKind.ProtectedKeyword
                    )
                    ? "protected"
                    : "public";

            analysis.methods.push({

                name:
                    node.name.getText(sourceFile),

                visibility,

                static:
                    node.modifiers?.some(
                        modifier =>
                            modifier.kind ===
                            ts.SyntaxKind.StaticKeyword
                    ) ?? false,

                async:
                    node.modifiers?.some(
                        modifier =>
                            modifier.kind ===
                            ts.SyntaxKind.AsyncKeyword
                    ) ?? false,

                abstract:
                    node.modifiers?.some(
                        modifier =>
                            modifier.kind ===
                            ts.SyntaxKind.AbstractKeyword
                    ) ?? false,

                parameters:
                    node.parameters.map(
                        parameter =>
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

        if (ts.isInterfaceDeclaration(node)) {

            const start =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getStart()
                );

            const end =
                sourceFile.getLineAndCharacterOfPosition(
                    node.getEnd()
                );

            const extendsTypes =
                node.heritageClauses
                    ?.filter(
                        clause =>
                            clause.token ===
                            ts.SyntaxKind.ExtendsKeyword
                    )
                    .flatMap(
                        clause =>
                            clause.types.map(type =>
                                type.expression.getText(sourceFile)
                            )
                    ) ?? [];

            const properties =
                node.members
                    .filter(ts.isPropertySignature)
                    .map(member =>
                        member.name.getText(sourceFile)
                    );

            const methods =
                node.members
                    .filter(ts.isMethodSignature)
                    .map(member =>
                        member.name.getText(sourceFile)
                    );
                    
            analysis.interfaces.push({

                name:
                    node.name.text,

                exported:
                    node.modifiers?.some(
                        modifier =>
                            modifier.kind ===
                            ts.SyntaxKind.ExportKeyword
                    ) ?? false,

                extends:
                    extendsTypes,

                properties,

                methods,

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