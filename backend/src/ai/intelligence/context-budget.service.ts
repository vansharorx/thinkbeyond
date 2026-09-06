import type { EvidenceItem } from "./intelligence.types";

export interface ContextBudget {
  maxCharacters: number;
  maxEvidenceItems: number;
  maxItemCharacters: number;
}

export const selectEvidence = (
  evidence: EvidenceItem[],
  budget: ContextBudget
): EvidenceItem[] => {
  const seen = new Set<string>();
  const selected: EvidenceItem[] = [];
  let characters = 0;

  for (const item of evidence) {
    const key = `${item.type}:${item.path ?? ""}:${item.symbol ?? ""}:${item.origin}`;
    if (seen.has(key) || selected.length >= budget.maxEvidenceItems) continue;

    const content = item.content.slice(0, budget.maxItemCharacters);
    const projected = characters + content.length;
    if (selected.length > 0 && projected > budget.maxCharacters) continue;

    seen.add(key);
    selected.push({ ...item, content });
    characters += content.length;
    if (characters >= budget.maxCharacters) break;
  }

  return selected;
};

export const boundedPromptValue = (value: unknown, maxCharacters: number): unknown => {
  const serialized = JSON.stringify(value, null, 2);
  if (serialized.length <= maxCharacters) return value;
  return {
    truncated: true,
    content: serialized.slice(0, maxCharacters),
  };
};