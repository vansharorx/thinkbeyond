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

        // handlers will go here

        ts.forEachChild(
            node,
            visit
        );

    }

    visit(sourceFile);

    return analysis;

};