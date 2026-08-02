import ts from "typescript";
import type { ASTAnalysis } from "../../types/ast.types";

import { discoverFunctions } from "./discoveries/function-discovery.service";
import { discoverClasses } from "./discoveries/class-discovery.service";
import { discoverInterfaces } from "./discoveries/interface-discovery.service";
import { discoverEnums } from "./discoveries/enum-discovery.service";
import { discoverMethods } from "./discoveries/method-discovery.service";
import { discoverVariables } from "./discoveries/variable-discovery.service";
import { discoverTypeAliases } from "./discoveries/type-alias-discovery.service";

import type { VisitorContext } from "./visitors/visitor-context";

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

    const context: VisitorContext = {
        analysis,
        currentFunction: null,
        currentClass: null,
    };

    function visit(
        node: ts.Node
    ) {

        const previousFunction = context.currentFunction;
        const previousClass = context.currentClass;

        discoverFunctions(node, sourceFile, context);
        discoverClasses(node, sourceFile, context);
        discoverInterfaces(node, sourceFile, context);
        discoverEnums(node, sourceFile, context);
        discoverMethods(node, sourceFile, context);
        discoverVariables(node, sourceFile, context);
        discoverTypeAliases(node, sourceFile, context);

        if (ts.isFunctionDeclaration(node)) {
            context.currentFunction =
                node.name?.text ?? "anonymous";
        }

        if (ts.isClassDeclaration(node)) {
            context.currentClass =
                node.name?.text ?? "anonymous";
        }

        if (ts.isMethodDeclaration(node)) {
            context.currentFunction = node.name.getText(sourceFile);
        }

        ts.forEachChild(
            node,
            visit
        );

        context.currentFunction = previousFunction;
        context.currentClass = previousClass;

    }

    visit(sourceFile);

    return analysis;

};