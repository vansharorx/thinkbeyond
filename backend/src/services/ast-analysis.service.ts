import { parseTypeScriptFile } from "./ast-parser.service";
import { visitAST } from "./ast-visitor.service";

import type { FunctionInfo } from "./function-discovery.service";
import type { ClassInfo } from "./class-discovery.service";
import type { InterfaceInfo } from "./interface-discovery.service";
import type { EnumInfo } from "./enum-discovery.service";
import type { TypeAliasInfo } from "./type-alias-discovery.service";
import type { VariableInfo } from "./variable-discovery.service";
import type { MethodInfo } from "./method-discovery.service";

export interface ASTAnalysis {
    functions: FunctionInfo[];
    classes: ClassInfo[];
    methods: MethodInfo[];
    interfaces: InterfaceInfo[];
    enums: EnumInfo[];
    typeAliases: TypeAliasInfo[];
    variables: VariableInfo[];
}

export const analyzeAST = async (
    filePath: string
): Promise<ASTAnalysis> => {

    const sourceFile =
        await parseTypeScriptFile(filePath);

    return visitAST(sourceFile);
};