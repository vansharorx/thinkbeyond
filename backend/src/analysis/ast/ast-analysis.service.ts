import { parseTypeScriptFile } from "./ast-parser.service";
import { visitAST } from "./ast-visitor.service";

import type { ASTAnalysis } from "../../types/ast.types";

export const analyzeAST = async (
    filePath: string
): Promise<ASTAnalysis> => {

    const sourceFile =
        await parseTypeScriptFile(filePath);

    return visitAST(sourceFile);
};