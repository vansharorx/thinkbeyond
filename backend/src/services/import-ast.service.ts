import ts from "typescript";
import { parseTypeScriptFile } from "./ast-parser.service";

export interface ImportedSymbol {
    imported: string;
    local: string;
}

export interface ImportInfo {
    module: string;

    type: "internal" | "external";

    defaultImport: string | null;

    namespaceImport: string | null;

    namedImports: ImportedSymbol[];

    isTypeOnly: boolean;
}

export const analyzeImportsAST = async (
    filePath: string
): Promise<ImportInfo[]> => {

    const sourceFile =
        await parseTypeScriptFile(filePath);

    const imports: ImportInfo[] = [];

    sourceFile.forEachChild(node => {

        if (!ts.isImportDeclaration(node)) {
            return;
        }

        const module =
            (
                node.moduleSpecifier as ts.StringLiteral
            ).text;

        const importClause = node.importClause;

        let defaultImport: string | null = null;

        let namespaceImport: string | null = null;

        const namedImports: ImportedSymbol[] = [];

        if (importClause) {

            defaultImport =
                importClause.name?.text ?? null;

            if (importClause.namedBindings) {

                if (
                    ts.isNamespaceImport(
                        importClause.namedBindings
                    )
                ) {

                    namespaceImport =
                        importClause
                            .namedBindings
                            .name
                            .text;

                }

                if (
                    ts.isNamedImports(
                        importClause.namedBindings
                    )
                ) {

                    for (
                        const element of
                        importClause.namedBindings.elements
                    ) {

                        namedImports.push({

                            imported:
                                element.propertyName?.text ??
                                element.name.text,

                            local:
                                element.name.text,

                        });

                    }

                }

            }

        }

        imports.push({

            module,

            type:
                module.startsWith(".")
                    ? "internal"
                    : "external",

            defaultImport,

            namespaceImport,

            namedImports,

            isTypeOnly:
                importClause?.isTypeOnly ?? false,

        });

    });

    return imports;
};