import { loadRepositoryExplorerState } from "../../services/repository-explorer-state.service";
import { buildSymbolContext } from "../context/symbol-context.service";
import { runAiTask } from "./ai-runner.service";

export interface ExplainSymbolResponse {
  repositoryId: string;
  provider: string;
  symbol: NonNullable<ReturnType<typeof buildSymbolContext>>;
  summary: string;
  impact: NonNullable<ReturnType<typeof buildSymbolContext>>["impact"];
}

export const explainSymbol = async (
  repositoryId: string,
  symbolName: string,
  matchMode: "exact" | "partial" = "exact"
): Promise<ExplainSymbolResponse | null> => {
  const state = await loadRepositoryExplorerState(repositoryId);
  if (!state) {
    return null;
  }

  const symbol = buildSymbolContext(state, symbolName, matchMode);
  if (!symbol) {
    return null;
  }

  const prompt = await runAiTask("explainSymbol", symbol, symbolName);

  return {
    repositoryId,
    provider: prompt.provider,
    symbol,
    summary: prompt.content,
    impact: symbol.impact,
  };
};
