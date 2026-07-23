import { parseTypeScriptFile } from "./ast-parser.service";

import { discoverFunctions } from "./function-discovery.service";
import { discoverClasses } from "./class-discovery.service";
import { discoverInterfaces } from "./interface-discovery.service";
import { discoverEnums } from "./enum-discovery.service";
import { discoverTypeAliases } from "./type-alias-discovery.service";
import { discoverVariables } from "./variable-discovery.service";

import { FunctionInfo } from "./function-discovery.service";
import { ClassInfo } from "./class-discovery.service";
import { InterfaceInfo } from "./interface-discovery.service";
import { EnumInfo } from "./enum-discovery.service";
import { TypeAliasInfo } from "./type-alias-discovery.service";
import { VariableInfo } from "./variable-discovery.service";
import { MethodInfo } from "./method-discovery.service";
import { discoverMethods } from "./method-discovery.service";

export interface ASTAnalysis {

    functions: FunctionInfo[];

    classes: ClassInfo[];

    interfaces: InterfaceInfo[];

    enums: EnumInfo[];

    typeAliases: TypeAliasInfo[];

    variables: VariableInfo[];

    methods: MethodInfo[];
}

export const analyzeAST = async (
    filePath: string
): Promise<ASTAnalysis> => {

    const sourceFile =
        await parseTypeScriptFile(filePath);

    return {

        functions:
            discoverFunctions(sourceFile),

        classes:
            discoverClasses(sourceFile),

        interfaces:
            discoverInterfaces(sourceFile),

        enums:
            discoverEnums(sourceFile),

        typeAliases:
            discoverTypeAliases(sourceFile),

        variables:
            discoverVariables(sourceFile),

        methods:
            discoverMethods(sourceFile),
    };

};