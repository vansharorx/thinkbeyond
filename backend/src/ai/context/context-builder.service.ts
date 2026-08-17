import type { RepositoryExplorerState } from "../../services/repository-explorer-state.service";
import { buildRepositoryContext, type RepositoryContext } from "./repository-context.service";
import { buildFileContext, type FileContext } from "./file-context.service";
import { buildSymbolContext, type SymbolContext } from "./symbol-context.service";

export interface AiContextBuilder {
  repository: RepositoryContext;
  file: FileContext | null;
  symbol: SymbolContext | null;
}

export const buildAiContext = async (
  state: RepositoryExplorerState,
  filePath?: string,
  symbolName?: string,
  matchMode: "exact" | "partial" = "exact"
): Promise<AiContextBuilder> => {
  const repository = await buildRepositoryContext(state);
  const file = filePath ? buildFileContext(state, filePath) : null;
  const symbol = symbolName ? buildSymbolContext(state, symbolName, matchMode) : null;

  return {
    repository,
    file,
    symbol,
  };
};
