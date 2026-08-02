import type { ASTAnalysis } from "../../../types/ast.types";

export interface VisitorContext {
    analysis: ASTAnalysis;
    currentFunction: string | null;
    currentClass: string | null;
}
