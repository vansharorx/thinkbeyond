import ts from "typescript";

import type { ASTAnalysis } from "../../types/ast.types";

export interface FunctionCall {

    caller: string;

    callee: string;

}

export interface CallGraph {

    calls: FunctionCall[];

}

export const buildCallGraph = (
    ast: ASTAnalysis,
    sourceFile: ts.SourceFile
): CallGraph => {

    const calls: FunctionCall[] = [];

    let currentFunction: string | null = null;

    function visit(node: ts.Node) {

        if (
            ts.isFunctionDeclaration(node) &&
            node.name
        ) {

            const previous = currentFunction;

            currentFunction = node.name.text;

            ts.forEachChild(node, visit);

            currentFunction = previous;

            return;
        }

        if (
            ts.isMethodDeclaration(node) &&
            ts.isIdentifier(node.name)
        ) {

            const previous = currentFunction;

            currentFunction = node.name.text;

            ts.forEachChild(node, visit);

            currentFunction = previous;

            return;
        }

        if (
            currentFunction &&
            ts.isCallExpression(node)
        ) {

            if (
                ts.isIdentifier(node.expression)
            ) {

                calls.push({

                    caller: currentFunction,

                    callee: node.expression.text,

                });

            }

        }

        ts.forEachChild(node, visit);

    }

    visit(sourceFile);

    return {

        calls,

    };

};