import { AppError } from "../utils/AppError";
import { executeRepositoryIntelligenceQuery } from "./repository-intelligence-query.service";
import type { RepositoryIntelligenceQuery, RepositoryIntelligenceResult } from "../types/repository-intelligence-query.types";
import {
  REASONING_OPERATIONS,
  type ReasoningEvidence,
  type ReasoningFinding,
  type ReasoningPlan,
  type ReasoningRelationship,
  type RepositoryReasoningRequest,
  type RepositoryReasoningResult,
} from "../types/repository-reasoning.types";

const DEFAULT_MAX_QUERIES = 8;
const DEFAULT_MAX_RESULTS = 20;
const DEFAULT_MAX_FINDINGS = 30;
const DEFAULT_MAX_EVIDENCE = 50;
const DEFAULT_DEPTH = 2;
const MAX_DEPTH = 5;
const MAX_LIMIT = 100;

export const executeRepositoryReasoning = async (
  repositoryId: string,
  request: RepositoryReasoningRequest
): Promise<RepositoryReasoningResult | null> => {
  validateRequest(request);
  const maxQueries = request.maxQueries ?? DEFAULT_MAX_QUERIES;
  const maxResults = request.limit ?? DEFAULT_MAX_RESULTS;
  const maxFindings = request.maxFindings ?? DEFAULT_MAX_FINDINGS;
  const maxEvidenceItems = request.maxEvidenceItems ?? DEFAULT_MAX_EVIDENCE;
  const depth = request.depth ?? DEFAULT_DEPTH;
  const plan = buildReasoningPlan(request, maxResults, depth).slice(0, maxQueries);
  const evidence: ReasoningEvidence[] = [];

  for (const query of plan) {
    const result = await executeRepositoryIntelligenceQuery(repositoryId, query);
    if (!result) return null;
    evidence.push({
      id: evidenceId(query, result),
      operation: query.operation,
      source: result.metadata.source,
      result,
    });
    if (hasAmbiguousSymbol(result)) break;
  }

  const boundedEvidence = dedupeEvidence(evidence).slice(0, maxEvidenceItems);
  const findings = deriveFindings(boundedEvidence).slice(0, maxFindings);
  const relationships = deriveRelationships(boundedEvidence, findings);
  const sources = unique(boundedEvidence.map(item => item.source));

  return {
    success: true,
    repositoryId,
    operation: request.operation,
    target: {
      symbolName: request.symbolName,
      filePath: request.filePath,
      from: request.from,
      to: request.to,
    },
    summary: summarize(request.operation, boundedEvidence, findings),
    plan: { operation: request.operation, queries: plan },
    findings,
    evidence: boundedEvidence,
    relationships,
    sources,
    metadata: {
      queryCount: plan.length,
      findingCount: findings.length,
      evidenceCount: boundedEvidence.length,
      maxQueries,
      maxResultsPerQuery: maxResults,
      maxFindings,
      maxEvidenceItems,
      depth,
    },
  };
};

function buildReasoningPlan(
  request: RepositoryReasoningRequest,
  limit: number,
  depth: number
): RepositoryIntelligenceQuery[] {
  const symbol = request.symbolName;
  const file = request.filePath;
  const base = { filePath: file, symbolName: symbol, limit, depth };
  const queries: RepositoryIntelligenceQuery[] = [];

  switch (request.operation) {
    case "explain":
    case "symbol-analysis":
      if (!symbol) throw new AppError("symbolName is required for symbol reasoning", 400);
      queries.push({ operation: "symbol", ...base });
      queries.push({ operation: "callers", ...base });
      queries.push({ operation: "callees", ...base });
      if (file) queries.push({ operation: "dependencies", filePath: file, limit });
      queries.push({ operation: "neighbors", ...base });
      break;
    case "change-analysis":
    case "impact":
      if (!file && !symbol) throw new AppError("filePath or symbolName is required for change reasoning", 400);
      if (symbol) queries.push({ operation: "symbol", ...base });
      queries.push({ operation: "impact", ...base });
      if (file) {
        queries.push({ operation: "dependencies", filePath: file, limit });
        queries.push({ operation: "dependents", filePath: file, limit });
        queries.push({ operation: "neighbors", filePath: file, depth, limit });
      }
      break;
    case "dependency-analysis":
      if (!file) throw new AppError("filePath is required for dependency reasoning", 400);
      queries.push({ operation: "dependencies", filePath: file, limit });
      queries.push({ operation: "dependents", filePath: file, limit });
      queries.push({ operation: "neighbors", filePath: file, depth, limit });
      if (request.from && request.to) queries.push({ operation: "path", from: request.from, to: request.to, limit, depth });
      break;
    case "relationship-analysis":
      if (!symbol) throw new AppError("symbolName is required for relationship reasoning", 400);
      queries.push({ operation: "symbol", ...base });
      queries.push({ operation: "callers", ...base });
      queries.push({ operation: "callees", ...base });
      queries.push({ operation: "neighbors", ...base });
      queries.push({ operation: "related", ...base });
      break;
    case "architecture-analysis":
      queries.push({ operation: "overview", limit });
      queries.push({ operation: "architecture", limit });
      queries.push({ operation: "metrics", limit });
      break;
    case "repository-overview":
      queries.push({ operation: "overview", limit });
      queries.push({ operation: "architecture", limit });
      queries.push({ operation: "metrics", limit });
      break;
    default:
      throw new AppError("Invalid reasoning operation", 400);
  }

  return dedupeQueries(queries);
}

function hasAmbiguousSymbol(result: RepositoryIntelligenceResult): boolean {
  const symbolDetails = result.details?.symbol as { ambiguous?: unknown } | undefined;
  return Boolean(symbolDetails?.ambiguous);
}

function deriveFindings(evidence: ReasoningEvidence[]): ReasoningFinding[] {
  const findings: ReasoningFinding[] = [];
  const byOperation = new Map(evidence.map(item => [item.operation, item]));
  const symbol = byOperation.get("symbol");
  const callers = byOperation.get("callers");
  const callees = byOperation.get("callees");
  const impact = byOperation.get("impact");
  const dependencies = byOperation.get("dependencies");
  const dependents = byOperation.get("dependents");
  const graph = byOperation.get("neighbors") ?? byOperation.get("related");

  if (symbol) {
    findings.push(finding("relationship", "Symbol definition resolved", "The requested symbol was resolved from persisted symbol intelligence.", [symbol], [symbol.source]));
  }
  if (callers && callers.result.results.length > 0) {
    findings.push(finding("caller", "Callers confirmed", `${callers.result.results.length} caller relationship(s) were returned by the call graph.`, [callers], [callers.source]));
  }
  if (callees && callees.result.results.length > 0) {
    findings.push(finding("callee", "Callees confirmed", `${callees.result.results.length} callee relationship(s) were returned by the call graph.`, [callees], [callees.source]));
  }
  if (dependencies && dependencies.result.results.length > 0) {
    findings.push(finding("dependency", "Direct dependencies confirmed", `${dependencies.result.results.length} dependency relationship(s) were returned by dependency intelligence.`, [dependencies], [dependencies.source]));
  }
  if (dependents && dependents.result.results.length > 0) {
    findings.push(finding("dependency", "Direct dependents confirmed", `${dependents.result.results.length} dependent relationship(s) were returned by reverse dependency intelligence.`, [dependents], [dependents.source]));
  }
  if (graph && graph.result.results.length > 0) {
    findings.push(finding("relationship", "Graph neighborhood confirmed", `${graph.result.results.length} neighboring graph node(s) were returned.`, [graph], [graph.source]));
  }
  if (impact) {
    const impactData = impact.result.details?.impact as { risk?: { level?: "low" | "medium" | "high"; score?: number }; directImpact?: unknown[]; indirectImpact?: unknown[] } | undefined;
    const risk = impactData?.risk;
    const directCount = impactData?.directImpact?.length ?? 0;
    const indirectCount = impactData?.indirectImpact?.length ?? 0;
    findings.push({
      id: "impact:risk",
      type: "impact",
      ...(risk?.level ? { severity: risk.level } : {}),
      title: "Change impact calculated",
      description: `${directCount} direct and ${indirectCount} indirect impact item(s) were calculated${risk?.score === undefined ? "." : ` with risk score ${risk.score}.`}`,
      evidence: [impact.id],
      sources: [impact.source],
    });
  }

  if (callers && impact) {
    const callerNames = new Set(callers.result.results.filter(value => typeof value === "string"));
    const impactNames = new Set(JSON.stringify(impact.result.details?.impact ?? {}).match(/[A-Za-z_$][\w$]*/g) ?? []);
    const overlap = [...callerNames].filter(name => impactNames.has(name));
    if (overlap.length > 0) {
      findings.push(finding("impact", "Caller and impact evidence overlap", `${overlap.length} caller(s) also appear in impact evidence.`, [callers, impact], [callers.source, impact.source]));
    }
  }

  return dedupeFindings(findings);
}

function deriveRelationships(evidence: ReasoningEvidence[], findings: ReasoningFinding[]): ReasoningRelationship[] {
  const relationships: ReasoningRelationship[] = [];
  const sources = unique(evidence.map(item => item.source));
  for (const finding of findings) {
    if (finding.sources.length >= 2) {
      relationships.push({ source: finding.sources[0], target: finding.sources[1], relationship: "overlaps", evidence: finding.evidence });
    } else if (finding.sources.length === 1) {
      relationships.push({ source: finding.sources[0], target: finding.id, relationship: "supports", evidence: finding.evidence });
    }
  }
  if (sources.length > 1) {
    for (let index = 1; index < sources.length; index += 1) {
      relationships.push({ source: sources[0], target: sources[index], relationship: "supports", evidence: [] });
    }
  }
  return dedupeRelationships(relationships);
}

function finding(type: ReasoningFinding["type"], title: string, description: string, evidence: ReasoningEvidence[], sources: string[]): ReasoningFinding {
  return { id: `${type}:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, type, title, description, evidence: evidence.map(item => item.id), sources: unique(sources) };
}

function summarize(operation: RepositoryReasoningRequest["operation"], evidence: ReasoningEvidence[], findings: ReasoningFinding[]): string {
  return `${operation} used ${evidence.length} deterministic intelligence result(s) and produced ${findings.length} evidence-backed finding(s).`;
}

function validateRequest(request: RepositoryReasoningRequest): void {
  if (!REASONING_OPERATIONS.includes(request.operation)) throw new AppError("Invalid reasoning operation", 400);
  validateBound("depth", request.depth, 1, MAX_DEPTH);
  validateBound("limit", request.limit, 1, MAX_LIMIT);
  validateBound("maxQueries", request.maxQueries, 1, DEFAULT_MAX_QUERIES);
  validateBound("maxFindings", request.maxFindings, 1, DEFAULT_MAX_FINDINGS);
  validateBound("maxEvidenceItems", request.maxEvidenceItems, 1, DEFAULT_MAX_EVIDENCE);
}

function validateBound(name: string, value: number | undefined, min: number, max: number): void {
  if (value !== undefined && (!Number.isInteger(value) || value < min || value > max)) throw new AppError(`${name} must be an integer between ${min} and ${max}`, 400);
}

function evidenceId(query: RepositoryIntelligenceQuery, result: RepositoryIntelligenceResult): string {
  return `${query.operation}:${result.metadata.source}:${JSON.stringify(result.target)}`;
}

function dedupeQueries(queries: RepositoryIntelligenceQuery[]): RepositoryIntelligenceQuery[] {
  const seen = new Set<string>();
  return queries.filter(query => {
    const key = JSON.stringify(query);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeEvidence(evidence: ReasoningEvidence[]): ReasoningEvidence[] {
  const seen = new Set<string>();
  return evidence.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function dedupeFindings(findings: ReasoningFinding[]): ReasoningFinding[] {
  const seen = new Set<string>();
  return findings.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function dedupeRelationships(relationships: ReasoningRelationship[]): ReasoningRelationship[] {
  const seen = new Set<string>();
  return relationships.filter(item => {
    const key = `${item.source}|${item.target}|${item.relationship}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(values: string[]): string[] { return [...new Set(values)]; }
