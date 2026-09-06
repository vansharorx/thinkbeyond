import { buildSymbolContext } from "../context/symbol-context.service";
import { runRepositoryIntelligence } from "../intelligence/intelligence-orchestrator.service";
import type { EvidenceItem, IntelligenceMetadata } from "../intelligence/intelligence.types";

export interface ExplainSymbolResponse {
  repositoryId: string;
  provider: string;
  symbol: NonNullable<ReturnType<typeof buildSymbolContext>>;
  summary: string;
  impact: NonNullable<ReturnType<typeof buildSymbolContext>>["impact"];
  evidence: EvidenceItem[];
  metadata: IntelligenceMetadata;
}

export const explainSymbol = async (
  repositoryId: string,
  symbolName: string,
  matchMode: "exact" | "partial" = "exact"
): Promise<ExplainSymbolResponse | null> => {
  const intelligence = await runRepositoryIntelligence({
    repositoryId,
    task: `Explain symbol ${symbolName}`,
    template: "explainSymbol",
    symbolName,
    matchMode,
  });
  if (!intelligence || !intelligence.structuredContext.symbol) return null;
  const symbol = intelligence.structuredContext.symbol;

  return {
    repositoryId,
    provider: intelligence.provider,
    symbol,
    summary: intelligence.answer,
    impact: symbol.impact,
    evidence: intelligence.evidence,
    metadata: intelligence.metadata,
  };
};
