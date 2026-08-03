import ts from "typescript";

import type { VisitorContext } from "../visitors/visitor-context";

export interface FunctionCallInfo {

    caller: string;

    callee: string;

}

export const discoverFunctionCalls = (
    node: ts.Node,
    context: VisitorContext
): void => {

    if (
        !context.currentFunction ||
        !ts.isCallExpression(node)
    ) {
        return;
    }

    if (
        ts.isIdentifier(node.expression)
    ) {

        context.analysis.functionCalls.push({

            caller: context.currentFunction,

            callee: node.expression.text,

        });

    }

};