import { AppError } from "../utils/AppError";
import { getRepositoryOverview } from "./repository-overview.service";
import { navigateRepositoryData } from "./repository-navigation.service";
import { getRepositoryImpact } from "./repository-impact.service";
import { getRepositoryDependencyIntelligence } from "./repository-dependency.service";
import { getRepositorySymbolIntelligence } from "./repository-symbol.service";
import { getRepositorySemanticGraph } from "./repository-semantic-graph.service";
import {
  REPOSITORY_QUERY_OPERATIONS,
  type RepositoryIntelligenceQuery,
  type RepositoryIntelligenceResult,
  type RepositoryQueryClassification,
  type RepositoryQueryOperation,
} from "../types/repository-intelligence-query.types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_DEPTH = 5;

function classified(
  operation: RepositoryQueryOperation,
  reason: string,
  candidates: RepositoryQueryOperation[] = [operation]
): RepositoryQueryClassification {
  return { operation, candidates, confidence: candidates.length === 1 ? "high" : "medium", reason };
}

export const classifyRepositoryQuery = (query: string): RepositoryQueryClassification => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return { candidates: ["search"], confidence: "ambiguous", reason: "The query is empty." };
  }
  if (/who calls|callers|called by/.test(normalized)) return classified("callers", "caller keywords matched");
  if (/what does .* call|callees|calls?\s/.test(normalized)) return classified("callees", "callee keywords matched");
  if (/what depends|dependencies of|depend on/.test(normalized)) return classified("dependencies", "dependency keywords matched");
  if (/who depends|used by|dependents/.test(normalized)) return classified("dependents", "reverse dependency keywords matched");
  if (/what happens if|what would break|impact|affected|change .* impact/.test(normalized)) return classified("impact", "impact keywords matched");
  if (/connected|connection|path between|how .* connect/.test(normalized)) return classified("path", "graph connection keywords matched", ["path", "neighbors", "related"]);
  if (/around|neighbors|nearby/.test(normalized)) return classified("neighbors", "neighborhood keywords matched");
  if (/architecture|architectural|layer/.test(normalized)) return classified("architecture", "architecture keywords matched");
  if (/metric|how large|size|health|dead code|how many/.test(normalized)) return classified("metrics", "metrics keywords matched", ["metrics", "overview"]);
  if (/overview|summary|repository information/.test(normalized)) return classified("overview", "overview keywords matched");
  if (/related|relationship/.test(normalized)) return classified("related", "relationship keywords matched");
  return {
    operation: "search",
    candidates: ["search", "symbol"],
    confidence: "medium",
    reason: "No structural intent keyword matched; deterministic search is the fallback.",
  };
};

export const executeRepositoryIntelligenceQuery = async (
  repositoryId: string,
  request: RepositoryIntelligenceQuery,
  classification?: RepositoryQueryClassification
): Promise<RepositoryIntelligenceResult | null> => {
  validateRequest(request);
  const limit = request.limit ?? DEFAULT_LIMIT;
  const depth = request.depth;
  const target = {
    query: request.query,
    symbolName: request.symbolName,
    filePath: request.filePath,
    from: request.from,
    to: request.to,
  };

  switch (request.operation) {
    case "search":
      return executeSearch(repositoryId, request, classification, target, limit);
    case "symbol":
      return executeSymbol(repositoryId, request, classification, target);
    case "callers":
    case "callees":
      return executeSymbolRelationship(repositoryId, request, classification, target, request.operation);
    case "dependencies":
    case "dependents":
      return executeDependency(repositoryId, request, classification, target, request.operation, limit);
    case "impact":
      return executeImpact(repositoryId, request, classification, target);
    case "path":
      return executeGraph(repositoryId, request, classification, target, "path", limit);
    case "neighbors":
    case "related":
      return executeGraph(repositoryId, request, classification, target, request.operation, limit);
    case "architecture":
    case "metrics":
    case "overview":
      return executeOverview(repositoryId, request, classification, target, request.operation, limit);
    default:
      return null;
  }
};

export const queryRepositoryIntelligence = async (
  repositoryId: string,
  request: Omit<RepositoryIntelligenceQuery, "operation"> & { operation?: RepositoryQueryOperation }
): Promise<RepositoryIntelligenceResult | null> => {
  const operation = request.operation ?? classifyRepositoryQuery(request.query ?? "").operation;
  if (!operation) throw new AppError("Unable to classify repository query", 400);
  return executeRepositoryIntelligenceQuery(repositoryId, { ...request, operation }, classifyRepositoryQuery(request.query ?? ""));
};

async function executeSearch(
  repositoryId: string,
  request: RepositoryIntelligenceQuery,
  classification: RepositoryQueryClassification | undefined,
  target: RepositoryIntelligenceResult["target"],
  limit: number
): Promise<RepositoryIntelligenceResult | null> {
  const query = request.query ?? request.symbolName ?? "";
  if (!query.trim()) throw new AppError("query is required for search", 400);
  const navigation = await navigateRepositoryData(repositoryId, query);
  if (!navigation) return null;
  const results = navigation.results.slice(0, limit);
  return normalized(repositoryId, "search", results, results.filter(item => item.type === "relationship"), "navigation", target, limit, classification, { navigation: navigation.metadata });
}

async function executeSymbol(
  repositoryId: string,
  request: RepositoryIntelligenceQuery,
  classification: RepositoryQueryClassification | undefined,
  target: RepositoryIntelligenceResult["target"]
): Promise<RepositoryIntelligenceResult | null> {
  const response = await getRepositorySymbolIntelligence(repositoryId, {
    operation: request.query ? "search" : "overview",
    symbolName: request.symbolName,
    query: request.query,
    filePath: request.filePath,
    workspace: request.workspace,
    kind: request.kind,
  });
  if (!response) return null;
  if (!response.symbol && !response.search && !response.ambiguous) throw new AppError("Symbol not found", 404);
  const results = response.search ?? (response.symbol ? [response.symbol] : response.ambiguous?.matches ?? []);
  return normalized(repositoryId, "symbol", results.slice(0, request.limit ?? DEFAULT_LIMIT), [], "symbol-intelligence", target, request.limit ?? DEFAULT_LIMIT, classification, { symbol: response });
}

async function executeSymbolRelationship(
  repositoryId: string,
  request: RepositoryIntelligenceQuery,
  classification: RepositoryQueryClassification | undefined,
  target: RepositoryIntelligenceResult["target"],
  operation: "callers" | "callees"
): Promise<RepositoryIntelligenceResult | null> {
  if (!request.symbolName) throw new AppError("symbolName is required for symbol relationships", 400);
  const response = await getRepositorySymbolIntelligence(repositoryId, {
    operation,
    symbolName: request.symbolName,
    filePath: request.filePath,
    workspace: request.workspace,
  });
  if (!response) return null;
  if (response.ambiguous) return normalized(repositoryId, operation, response.ambiguous.matches, [], "symbol-intelligence", target, request.limit ?? DEFAULT_LIMIT, classification, { ambiguous: response.ambiguous });
  if (!response.symbol) throw new AppError("Symbol not found", 404);
  const values = operation === "callers" ? response.symbol.callers : response.symbol.callees;
  return normalized(repositoryId, operation, values.slice(0, request.limit ?? DEFAULT_LIMIT), [], "call-graph", target, request.limit ?? DEFAULT_LIMIT, classification, { symbol: response.symbol });
}

async function executeDependency(
  repositoryId: string,
  request: RepositoryIntelligenceQuery,
  classification: RepositoryQueryClassification | undefined,
  target: RepositoryIntelligenceResult["target"],
  operation: "dependencies" | "dependents",
  limit: number
): Promise<RepositoryIntelligenceResult | null> {
  if (!request.filePath) throw new AppError("filePath is required for dependency queries", 400);
  const response = await getRepositoryDependencyIntelligence(repositoryId, {
    filePath: request.filePath,
    operation,
  });
  if (!response) throw new AppError("File not found", 404);
  const values = operation === "dependencies" ? response.dependencies : response.dependents;
  return normalized(repositoryId, operation, values.slice(0, limit), [], "dependency-intelligence", target, limit, classification, { dependency: response });
}

async function executeImpact(
  repositoryId: string,
  request: RepositoryIntelligenceQuery,
  classification: RepositoryQueryClassification | undefined,
  target: RepositoryIntelligenceResult["target"]
): Promise<RepositoryIntelligenceResult | null> {
  if (!request.filePath && !request.symbolName) throw new AppError("filePath or symbolName is required for impact queries", 400);
  const response = await getRepositoryImpact(repositoryId, { filePath: request.filePath, symbolName: request.symbolName });
  if (!response) throw new AppError(request.symbolName ? "Symbol not found" : "File not found", 404);
  const values = [...response.directImpact, ...response.indirectImpact].slice(0, request.limit ?? DEFAULT_LIMIT);
  return normalized(repositoryId, "impact", values, [], "impact-analysis", target, request.limit ?? DEFAULT_LIMIT, classification, { impact: response });
}

async function executeGraph(
  repositoryId: string,
  request: RepositoryIntelligenceQuery,
  classification: RepositoryQueryClassification | undefined,
  target: RepositoryIntelligenceResult["target"],
  operation: "path" | "neighbors" | "related",
  limit: number
): Promise<RepositoryIntelligenceResult | null> {
  const graphOperation = operation === "related" ? "related" : operation;
  if (graphOperation === "path" && (!request.from || !request.to)) throw new AppError("from and to are required for path queries", 400);
  if (graphOperation !== "path" && !request.nodeId && !request.symbolName && !request.filePath) throw new AppError("nodeId, symbolName, or filePath is required for graph queries", 400);
  const response = await getRepositorySemanticGraph(repositoryId, {
    operation: graphOperation,
    nodeId: request.nodeId,
    symbolName: request.symbolName,
    filePath: request.filePath,
    from: request.from,
    to: request.to,
    depth: request.depth,
  });
  if (!response) return null;
  if (graphOperation !== "path" && !response.node) throw new AppError("Graph target not found", 404);
  if (graphOperation === "path") {
    const path = response.path!;
    return normalized(repositoryId, "path", path.path.slice(0, limit), path.relationships.slice(0, limit), "semantic-graph", target, limit, classification, { path });
  }
  const values = response.neighbors ?? response.nodes ?? [];
  return normalized(repositoryId, operation, values.slice(0, limit), (response.relationships ?? []).slice(0, limit), "semantic-graph", target, limit, classification, { graph: response });
}

async function executeOverview(
  repositoryId: string,
  request: RepositoryIntelligenceQuery,
  classification: RepositoryQueryClassification | undefined,
  target: RepositoryIntelligenceResult["target"],
  operation: "architecture" | "metrics" | "overview",
  limit: number
): Promise<RepositoryIntelligenceResult | null> {
  const overview = await getRepositoryOverview(repositoryId);
  if (!overview) return null;
  const state = operation === "architecture" ? overview.architecture : operation === "metrics" ? [overview.metrics] : [overview];
  return normalized(repositoryId, operation, state.slice(0, limit), [], operation === "architecture" ? "architecture" : operation === "metrics" ? "metrics" : "repository-overview", target, limit, classification, { overview });
}

function validateRequest(request: RepositoryIntelligenceQuery): void {
  if (!REPOSITORY_QUERY_OPERATIONS.includes(request.operation)) throw new AppError("Invalid query operation", 400);
  if (request.limit !== undefined && (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > MAX_LIMIT)) throw new AppError(`limit must be an integer between 1 and ${MAX_LIMIT}`, 400);
  if (request.depth !== undefined && (!Number.isInteger(request.depth) || request.depth < 1 || request.depth > MAX_DEPTH)) throw new AppError(`depth must be an integer between 1 and ${MAX_DEPTH}`, 400);
}

function normalized(
  repositoryId: string,
  operation: RepositoryQueryOperation,
  results: unknown[],
  relationships: unknown[],
  source: string,
  target: RepositoryIntelligenceResult["target"],
  limit: number,
  classification?: RepositoryQueryClassification,
  details?: Record<string, unknown>
): RepositoryIntelligenceResult {
  return {
    success: true,
    repositoryId,
    operation,
    target,
    results,
    relationships,
    metadata: {
      count: results.length,
      source,
      limit,
      ...(classification ? { classification } : {}),
    },
    ...(details ? { details } : {}),
  };
}
