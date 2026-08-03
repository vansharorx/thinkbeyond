export interface FunctionInfo {
  name: string;
  async: boolean;
  exported: boolean;
  parameters: string[];
  returnType: string | null;
  startLine: number;
  endLine: number;
}

export interface ClassInfo {
  name: string;
  exported: boolean;
  abstract: boolean;
  extends: string | null;
  implements: string[];
  startLine: number;
  endLine: number;
}

export interface MethodInfo {
  name: string;
  visibility: "public" | "private" | "protected";
  static: boolean;
  async: boolean;
  abstract: boolean;
  parameters: string[];
  returnType: string | null;
  startLine: number;
  endLine: number;
}

export interface InterfaceInfo {
  name: string;
  exported: boolean;
  extends: string[];
  properties: string[];
  methods: string[];
  startLine: number;
  endLine: number;
}

export interface EnumInfo {
  name: string;
  exported: boolean;
  const: boolean;
  members: string[];
  startLine: number;
  endLine: number;
}

export interface TypeAliasInfo {
  name: string;
  exported: boolean;
  generics: string[];
  definition: string;
  startLine: number;
  endLine: number;
}

export interface VariableInfo {
  name: string;
  kind: "const" | "let" | "var";
  exported: boolean;
  type: string | null;
  initializer: string | null;
  startLine: number;
  endLine: number;
}

export interface ASTAnalysis {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  methods: MethodInfo[];
  interfaces: InterfaceInfo[];
  enums: EnumInfo[];
  typeAliases: TypeAliasInfo[];
  variables: VariableInfo[];
  functionCalls: FunctionCallInfo[];
}

export interface FunctionCallInfo {
  caller: string;
  callee: string;
}