import { AppError } from "../utils/AppError";
import {
  classifyRepositoryQuery,
  executeRepositoryIntelligenceQuery,
} from "./repository-intelligence-query.service";
import type {
  RepositoryIntelligenceQuery,
  RepositoryIntelligenceResult,
  RepositoryQueryOperation,
} from "../types/repository-intelligence-query.types";
import {
  INVESTIGATION_OPERATIONS,
  type InvestigationChangePlan,
  type InvestigationConfidence,
  type InvestigationFinding,
  type InvestigationFindingCategory,
  type InvestigationOperation,
  type InvestigationRecommendation,
  type InvestigationStepPlan,
  type InvestigationStepResult,
  type RepositoryInvestigationRequest,
  type RepositoryInvestigationResult,
} from "../types/repository-investigation.types";

const DEFAULT_MAX_STEPS = 8;
const DEFAULT_MAX_RESULTS = 20;
const DEFAULT_MAX_DEPTH = 3;
const MAX_STEPS = 12;
const MAX_RESULTS = 50;
const MAX_DEPTH = 5;

export const executeRepositoryInvestigation = async (
  repositoryId: string,
  request: RepositoryInvestigationRequest
): Promise<RepositoryInvestigationResult | null> => {
  validateRequest(request);
  const maxSteps = request.maxSteps ?? DEFAULT_MAX_STEPS;
  const maxResults = request.maxResultsPerStep ?? DEFAULT_MAX_RESULTS;
  const maxDepth = request.maxDepth ?? DEFAULT_MAX_DEPTH;
  const intent = classifyInvestigationIntent(request.query, request.operation);
  const initialPlan = buildInitialPlan(request.query, maxResults);
  const steps: InvestigationStepResult[] = [];
  const plans: InvestigationStepPlan[] = [];
  const executedKeys = new Set<string>();
  let target = resolveExplicitTarget(request.query);
  let repositoryFound = false;

  for (const plan of initialPlan) {
    if (plans.length >= maxSteps) break;
    plans.push(plan);
    const step = await executeStep(repositoryId, plan, executedKeys);
    steps.push(step);
    if (!step.result) continue;
    repositoryFound = true;
    target = mergeTargets(target, resolveTargetFromResult(step.result));
  }

  if (!repositoryFound && steps.some(step => step.status === "executed")) return null;

  const followUpPlan = buildFollowUpPlan(intent, target, maxResults, maxDepth);
  for (const plan of followUpPlan) {
    if (plans.length >= maxSteps) break;
    plans.push(plan);
    const step = await executeStep(repositoryId, plan, executedKeys);
    steps.push(step);
  }

  const findings = deriveFindings(steps);
  const recommendations = deriveRecommendations(findings);
  const sources = unique(steps.flatMap(step => step.result ? [step.result.metadata.source] : []));
  const confidence = assessConfidence(findings, sources, steps);
  const changePlan = isChangeIntent(intent)
    ? buildChangePlan(steps, findings)
    : undefined;

  return {
    success: true,
    repositoryId,
    query: request.query.trim(),
    intent,
    plan: plans,
    steps,
    findings,
    recommendations,
    sources,
    confidence,
    stats: {
      stepsExecuted: steps.filter(step => step.status === "executed").length,
      resultsCollected: steps.reduce((count, step) => count + (step.result?.results.length ?? 0), 0),
      findingsGenerated: findings.length,
    },
    ...(changePlan ? { changePlan } : {}),
  };
};

function validateRequest(request: RepositoryInvestigationRequest): void {
  if (!request.query || !request.query.trim()) throw new AppError("query is required", 400);
  validateBound("maxSteps", request.maxSteps, 1, MAX_STEPS);
  validateBound("maxResultsPerStep", request.maxResultsPerStep, 1, MAX_RESULTS);
  if (request.operation && !INVESTIGATION_OPERATIONS.includes(request.operation)) {
    throw new AppError("Invalid investigation operation", 400);
  }
}

function validateBound(name: string, value: number | undefined, min: number, max: number): void {
  if (value !== undefined && (!Number.isInteger(value) || value < min || value > max)) {
    throw new AppError(`${name} must be an integer between ${min} and ${max}`, 400);
  }
}

function classifyInvestigationIntent(query: string, operation?: InvestigationOperation): string {
  if (operation) return operation;
  const normalized = query.toLowerCase();
  if (/what should i inspect|plan a change|before changing|change plan/.test(normalized)) return "change-plan";
  if (/risk|risky|what could break|what happens if|impact|affected/.test(normalized)) return "change-impact";
  if (/architecture concern|architectural concern|biggest architecture|architecture/.test(normalized)) return "architecture";
  if (/who calls|callers|called by|how does .* work|flow|authentication/.test(normalized)) return "call-flow";
  if (/what depends|dependencies|dependents|used by/.test(normalized)) return "dependency";
  if (/health|dead code|metric|metrics|large|complex/.test(normalized)) return "health";
  return classifyRepositoryQuery(query).operation ?? "search";
}

function buildInitialPlan(
  query: string,
  limit: number
): InvestigationStepPlan[] {
  return [plan("search", "Locate repository files, symbols, and relationships relevant to the request.", { operation: "search", query, limit }, 100)];
}

function buildFollowUpPlan(
  intent: string,
  target: Target,
  limit: number,
  depth: number
): InvestigationStepPlan[] {
  if (target.ambiguous) return [];
  const planned: InvestigationStepPlan[] = [];
  const add = (operation: RepositoryQueryOperation, reason: string, input: RepositoryIntelligenceQuery, priority: number): void => {
    planned.push(plan(operation, reason, input, priority));
  };
  const fileInput = target.filePath ? { filePath: target.filePath, limit } : null;
  const symbolInput = target.symbolName ? { symbolName: target.symbolName, limit, depth } : null;

  if (intent === "architecture" || intent === "health") {
    add("overview", "Establish repository-level structure and summary.", { operation: "overview", limit }, 90);
    add("architecture", "Inspect persisted architecture classifications.", { operation: "architecture", limit }, 85);
    add("metrics", "Inspect persisted repository metrics.", { operation: "metrics", limit }, 80);
    return dedupePlans(planned);
  }

  if (intent === "call-flow") {
    if (symbolInput) {
      add("symbol", "Resolve the requested symbol before tracing relationships.", { operation: "symbol", ...symbolInput }, 95);
      add("callers", "Inspect callers from the persisted call graph.", { operation: "callers", ...symbolInput }, 90);
      add("callees", "Inspect callees from the persisted call graph.", { operation: "callees", ...symbolInput }, 89);
    }
    if (fileInput && target.filePathExplicit) add("dependencies", "Inspect dependencies of the symbol's file.", { operation: "dependencies", ...fileInput }, 80);
    if (symbolInput) add("neighbors", "Inspect the symbol's semantic graph neighborhood.", { operation: "neighbors", ...symbolInput }, 75);
    return dedupePlans(planned);
  }

  if (intent === "dependency") {
    if (fileInput && target.filePathExplicit) {
      add("dependencies", "Inspect direct dependencies.", { operation: "dependencies", ...fileInput }, 95);
      add("dependents", "Inspect reverse dependencies.", { operation: "dependents", ...fileInput }, 94);
      add("neighbors", "Inspect nearby semantic graph relationships.", { operation: "neighbors", ...fileInput, depth }, 80);
    }
    return dedupePlans(planned);
  }

  if (intent === "change-impact" || intent === "change-plan") {
    if (fileInput || symbolInput) {
      add("impact", "Calculate direct and indirect change impact.", { operation: "impact", ...fileInput, ...symbolInput }, 100);
    }
    if (fileInput && target.filePathExplicit) {
      add("dependencies", "Inspect direct dependencies before a change.", { operation: "dependencies", ...fileInput }, 95);
      add("dependents", "Inspect direct dependents before a change.", { operation: "dependents", ...fileInput }, 94);
      add("neighbors", "Inspect the semantic neighborhood around the target.", { operation: "neighbors", ...fileInput, depth }, 82);
    }
    if (symbolInput) {
      add("callers", "Inspect callers that may be affected by a symbol change.", { operation: "callers", ...symbolInput }, 92);
      add("callees", "Inspect callees used by the target symbol.", { operation: "callees", ...symbolInput }, 91);
    }
    return dedupePlans(planned);
  }

  if (target.symbolName) {
    add("symbol", "Resolve the target symbol from persisted symbol intelligence.", { operation: "symbol", ...symbolInput! }, 90);
  }
  if (target.filePath && target.filePathExplicit) {
    add("dependencies", "Inspect target file dependencies.", { operation: "dependencies", filePath: target.filePath, limit }, 80);
  }
  return dedupePlans(planned);
}

async function executeStep(
  repositoryId: string,
  step: InvestigationStepPlan,
  executedKeys: Set<string>
): Promise<InvestigationStepResult> {
  const key = JSON.stringify(step.input);
  if (executedKeys.has(key)) return { plan: step, status: "skipped", error: "Duplicate investigation query." };
  executedKeys.add(key);
  try {
    const result = await executeRepositoryIntelligenceQuery(repositoryId, step.input);
    if (!result) return { plan: step, status: "skipped", error: "Repository not found." };
    return { plan: step, status: "executed", result };
  } catch (error) {
    return {
      plan: step,
      status: "skipped",
      error: error instanceof Error ? error.message : "Investigation step could not be executed.",
    };
  }
}

function deriveFindings(steps: InvestigationStepResult[]): InvestigationFinding[] {
  const findings: InvestigationFinding[] = [];
  for (const step of steps) {
    const result = step.result;
    if (!result) continue;
    if (hasAmbiguousResult(result)) {
      findings.push(finding("AMBIGUOUS_SYMBOL", "Ambiguous repository target", "Multiple repository symbols match the request; provide a file path or workspace to disambiguate.", "high", "low", step, result));
      continue;
    }
    if (result.results.length === 0 && result.relationships.length === 0) {
      findings.push(finding("INSUFFICIENT_EVIDENCE", "Insufficient repository evidence", "This investigation step returned no repository results.", "medium", "low", step, result));
    }
    const count = result.results.length;
    if ((result.operation === "dependencies" || result.operation === "dependents") && count >= 8) {
      const category = result.operation === "dependencies" ? "HIGH_DEPENDENCY_FANOUT" : "HIGH_DEPENDENT_FANOUT";
      findings.push(finding(category, result.operation === "dependencies" ? "High dependency fan-out" : "High dependent fan-out", `${count} direct ${result.operation} were returned by dependency intelligence.`, "high", "high", step, result));
      findings.push(finding("HIGH_COUPLING", "High repository coupling", "The target has a broad direct dependency relationship surface.", "high", "high", step, result));
    }
    if (result.operation === "impact") {
      const impact = record(result.details?.impact);
      const direct = arrayLength(impact?.directImpact);
      const indirect = arrayLength(impact?.indirectImpact);
      const risk = record(impact?.risk);
      if (direct + indirect >= 8) findings.push(finding("LARGE_IMPACT", "Large change impact", `${direct} direct and ${indirect} indirect impact items were returned.`, "high", "high", step, result));
      if (risk?.level === "high" || (typeof risk?.score === "number" && risk.score >= 70)) findings.push(finding("HIGH_CHANGE_RISK", "High change risk", "Persisted impact analysis reports a high-risk change boundary.", "high", "high", step, result));
    }
    if (result.operation === "neighbors" || result.operation === "related" || result.operation === "path") {
      if (result.relationships.length >= 6) findings.push(finding("COMPLEX_RELATIONSHIP", "Complex repository relationship", `${result.relationships.length} semantic relationships were returned for this target.`, "medium", "medium", step, result));
    }
    const dependency = record(result.details?.dependency);
    if (arrayLength(dependency?.cycles) > 0) findings.push(finding("CIRCULAR_DEPENDENCY", "Circular dependency detected", "Persisted dependency intelligence reports one or more cycles for this target.", "high", "high", step, result));
  }
  return dedupeFindings(findings);
}

function deriveRecommendations(findings: InvestigationFinding[]): InvestigationRecommendation[] {
  const recommendations: InvestigationRecommendation[] = [];
  for (const finding of findings) {
    if (finding.type === "HIGH_CHANGE_RISK" || finding.type === "LARGE_IMPACT" || finding.type === "HIGH_COUPLING") recommendations.push({ id: `recommendation:${finding.id}`, title: "Review the change boundary before modification", summary: "Inspect dependent callers, direct dependencies, and impacted files before changing this target.", findingIds: [finding.id], confidence: finding.confidence });
    if (finding.type === "CIRCULAR_DEPENDENCY") recommendations.push({ id: `recommendation:${finding.id}`, title: "Investigate the dependency cycle", summary: "Review the cycle and consider a shared boundary or extraction before changing one member.", findingIds: [finding.id], confidence: finding.confidence });
    if (finding.type === "AMBIGUOUS_SYMBOL") recommendations.push({ id: `recommendation:${finding.id}`, title: "Disambiguate the repository target", summary: "Provide a file path, workspace, or other context before relying on symbol relationships.", findingIds: [finding.id], confidence: finding.confidence });
    if (finding.type === "INSUFFICIENT_EVIDENCE") recommendations.push({ id: `recommendation:${finding.id}`, title: "Provide a more specific repository target", summary: "Add a file path, symbol name, or relationship context so the indexed repository evidence can answer the request.", findingIds: [finding.id], confidence: finding.confidence });
  }
  return uniqueRecommendations(recommendations);
}

function buildChangePlan(steps: InvestigationStepResult[], findings: InvestigationFinding[]): InvestigationChangePlan {
  const values = steps.flatMap(step => step.result ? collectValues(step.result) : []);
  const targetFiles = unique(values.filter(isFileValue));
  const targetSymbols = unique(values.filter(isSymbolValue));
  const impactValues = (field: string, filter: (value: string) => boolean): string[] => unique(steps
    .filter(step => step.result?.operation === "impact")
    .flatMap(step => {
      const impact = record(step.result?.details?.impact);
      return impact ? collectValues(impact[field]).filter(filter) : [];
    }));
  return {
    targetFiles,
    targetSymbols,
    dependencies: unique([...valuesFromOperations(steps, "dependencies"), ...impactValues("dependencies", isFileValue)]),
    dependents: unique([...valuesFromOperations(steps, "dependents"), ...impactValues("dependents", isFileValue)]),
    callers: unique([...valuesFromOperations(steps, "callers"), ...impactValues("callers", isSymbolValue)]),
    callees: unique([...valuesFromOperations(steps, "callees"), ...impactValues("callees", isSymbolValue)]),
    impactedFiles: valuesFromOperations(steps, "impact"),
    architecturalAreas: unique(steps.flatMap(step => step.result?.operation === "architecture" ? collectValues(step.result).filter(value => !isFileValue(value) && !isSymbolValue(value)) : [])),
    risks: findings.filter(finding => finding.type === "HIGH_CHANGE_RISK" || finding.type === "LARGE_IMPACT" || finding.type === "CIRCULAR_DEPENDENCY").map(finding => finding.title),
    validationAreas: unique(["affected callers", "direct dependencies", "dependent files", ...findings.filter(finding => finding.type === "HIGH_CHANGE_RISK").map(finding => finding.title)]),
  };
}

function valuesFromOperations(steps: InvestigationStepResult[], operation: RepositoryQueryOperation): string[] {
  const values = steps.filter(step => step.result?.operation === operation).flatMap(step => step.result ? collectValues(step.result) : []);
  return unique(values.filter(operation === "dependencies" || operation === "dependents" || operation === "impact" ? isFileValue : isSymbolValue));
}

function collectValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectValues);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, nested]) => {
    if (["path", "file", "source", "target", "symbol", "name", "caller", "callee", "architecture"].includes(key) && typeof nested === "string") return [nested];
    return collectValues(nested);
  });
}

function isFileValue(value: string): boolean {
  return value.includes("/") && /\.[a-z0-9]+$/i.test(value) && !value.startsWith("file:");
}

function isSymbolValue(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) && !INVESTIGATION_STOP_WORDS.has(value.toLowerCase()) && !["depends_on", "used_by", "architecture_member", "defines", "belongs_to", "contains"].includes(value);
}

function resolveExplicitTarget(query: string): Target {
  const fileMatch = query.match(/(?:^|\s)([A-Za-z0-9_./\\-]+\.[A-Za-z0-9]+)\b/);
  if (fileMatch) return { filePath: fileMatch[1].replace(/\\/g, "/"), filePathExplicit: true };
  const candidates = [...query.matchAll(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g)]
    .map(match => match[0])
    .filter(value => !INVESTIGATION_STOP_WORDS.has(value.toLowerCase()))
    .sort((left, right) => right.length - left.length);
  return candidates[0] ? { symbolName: candidates[0] } : {};
}

function resolveTargetFromResult(result: RepositoryIntelligenceResult): Target {
  const candidates = result.results.map(value => record(value)).filter((value): value is Record<string, unknown> => value !== null);
  const symbols = unique(candidates.map(value => typeof value.symbol === "string" ? value.symbol : typeof value.name === "string" ? value.name : "").filter(Boolean));
  const files = unique(candidates.map(value => typeof value.path === "string" ? value.path : typeof value.filePath === "string" ? value.filePath : "").filter(Boolean));
  if (symbols.length > 1 || Boolean(result.details?.ambiguous) || hasAmbiguousResult(result)) {
    return { ambiguous: true };
  }
  return {
    filePath: files[0],
    symbolName: symbols.length === 1 ? symbols[0] : undefined,
    ambiguous: symbols.length > 1,
  };
}

function mergeTargets(left: Target, right: Target): Target {
  return {
    filePath: left.filePath ?? right.filePath,
    filePathExplicit: left.filePathExplicit || right.filePathExplicit,
    symbolName: left.symbolName ?? right.symbolName,
    ambiguous: left.ambiguous || right.ambiguous,
  };
}

function plan(operation: RepositoryQueryOperation, reason: string, input: RepositoryIntelligenceQuery, priority: number): InvestigationStepPlan {
  return { id: `step:${operation}:${JSON.stringify(input)}`, operation, reason, input, priority };
}

function dedupePlans(plans: InvestigationStepPlan[]): InvestigationStepPlan[] {
  const seen = new Set<string>();
  return plans.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
}

function finding(type: InvestigationFindingCategory, title: string, summary: string, severity: "low" | "medium" | "high", confidence: InvestigationConfidence, step: InvestigationStepResult, result: RepositoryIntelligenceResult): InvestigationFinding {
  return {
    id: `finding:${type}:${step.plan.id}`,
    type,
    severity,
    title,
    summary,
    confidence,
    sources: [result.metadata.source],
    relatedFiles: unique([result.target?.filePath, ...collectValues(result).filter(value => value.includes("/") && /\.[a-z0-9]+$/i.test(value))].filter((value): value is string => Boolean(value))),
    relatedSymbols: unique([result.target?.symbolName, ...collectValues(result).filter(value => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value))].filter((value): value is string => Boolean(value))),
    evidence: [step.plan.id],
  };
}

function hasAmbiguousResult(result: RepositoryIntelligenceResult): boolean {
  const symbol = record(result.details?.symbol);
  return Boolean(symbol && "ambiguous" in symbol) || Boolean(result.details?.ambiguous);
}

function assessConfidence(findings: InvestigationFinding[], sources: string[], steps: InvestigationStepResult[]): InvestigationConfidence {
  if (findings.some(finding => finding.type === "AMBIGUOUS_SYMBOL" || finding.type === "INSUFFICIENT_EVIDENCE")) return "low";
  if (sources.length >= 2 && steps.filter(step => step.status === "executed").length >= 2) return "high";
  return sources.length > 0 ? "medium" : "low";
}

function isChangeIntent(intent: string): boolean {
  return intent === "change-impact" || intent === "change-plan";
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function unique(values: string[]): string[] { return [...new Set(values)]; }

function uniqueRecommendations(values: InvestigationRecommendation[]): InvestigationRecommendation[] {
  const seen = new Set<string>();
  return values.filter(value => {
    if (seen.has(value.id)) return false;
    seen.add(value.id);
    return true;
  });
}

function dedupeFindings(values: InvestigationFinding[]): InvestigationFinding[] {
  const seen = new Set<string>();
  return values.filter(value => {
    if (seen.has(value.id)) return false;
    seen.add(value.id);
    return true;
  }).sort((left, right) => right.severity.localeCompare(left.severity) || left.id.localeCompare(right.id));
}

type Target = { filePath?: string; filePathExplicit?: boolean; symbolName?: string; ambiguous?: boolean };

const INVESTIGATION_STOP_WORDS = new Set([
  "a", "an", "and", "architecture", "before", "by", "change", "changing", "company", "concern", "concerns",
  "could", "depends", "dependency", "does", "explain", "find", "for", "how", "if", "inspect", "is", "jwt",
  "module", "of", "on", "repository", "risky", "should", "the", "this", "to", "what", "when", "where", "who",
  "work", "works", "navigation", "repository_navigation", "relationship", "impact", "file", "direct", "medium", "high",
  "low", "search", "symbol", "backend", "variable", "function", "overview", "neighbors", "callers", "callees",
  "dependencies", "dependents", "source", "target", "workspace",
]);
