import { FunctionInfo } from "./function-discovery.service";
import { ClassInfo } from "./class-discovery.service";
import { InterfaceInfo } from "./interface-discovery.service";
import { EnumInfo } from "./enum-discovery.service";
import { TypeAliasInfo } from "./type-alias-discovery.service";
import { VariableInfo } from "./variable-discovery.service";

export interface ASTAnalysis {

    functions: FunctionInfo[];

    classes: ClassInfo[];

    interfaces: InterfaceInfo[];

    enums: EnumInfo[];

    typeAliases: TypeAliasInfo[];

    variables: VariableInfo[];

}