export type JsonObject = Record<string, unknown>;

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data?: T;
};

export type RepositoryId = string;

export type RepositoryOverview = {
  repositoryId: string;
  repositoryStatistics: JsonObject;
  healthScore: JsonObject;
  metrics: JsonObject;
  architecture: JsonObject[];
  largestFiles: JsonObject[];
  mostImportedFiles: JsonObject[];
  mostCalledFunctions: JsonObject[];
  circularDependencies: JsonObject[];
  deadCodeSummary: JsonObject;
};

export type RepositoryTreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: RepositoryTreeNode[];
};

export type RepositoryTreeResponse = {
  repositoryId: string;
  path: string;
  tree: RepositoryTreeNode;
};

export type SearchResultItem = {
  name?: string;
  path?: string;
  filePath?: string;
  kind?: string;
  score?: number;
  type?: string;
  workspace?: string;
  [key: string]: unknown;
};

export type RepositorySearchResponse = {
  repositoryId: string;
  query: string;
  results: {
    files?: SearchResultItem[];
    symbols?: SearchResultItem[];
    [key: string]: unknown;
  };
};

export type RepositoryResource = JsonObject & {
  repositoryId?: string;
  path?: string;
  relativePath?: string;
  name?: string;
  kind?: string;
  type?: string;
  workspace?: string;
  symbol?: string;
};

export type RepositoryAnswerResult = {
  answer: string;
  grounded: boolean;
  operation: string;
  sources: string[];
  findings: string[];
  evidenceCount: number;
  provider: string;
  metadata: {
    reasoningUsed: boolean;
    provider: string;
    sourceCount: number;
    evidenceSufficient: boolean;
    providerState: string;
    operation: string;
  };
  grounding: {
    unsupportedClaims: string[];
    claims: Array<{ claim: string; supportedBy: string[] }>;
    conflicts: string[];
    ambiguous: boolean;
    evidenceSufficient: boolean;
  };
  context: JsonObject;
  retrieval: {
    query: string;
    chunks: Array<{ id: string; kind: string; title: string; content: string; score: number; metadata: Record<string, unknown> }>;
  };
  evidence: Array<{ id: string; kind: string; operation: string; }>; 
};

export type RepositoryInvestigationResult = {
  success: boolean;
  repositoryId: string;
  query: string;
  intent: string;
  plan: Array<{ id: string; operation: string; reason: string; priority: number; input: JsonObject }>;
  steps: Array<{ plan: JsonObject; status: string; result?: JsonObject; error?: string }>;
  findings: Array<{ id: string; type: string; severity: string; title: string; summary: string; confidence: string }>;
  recommendations: Array<{ id: string; title: string; summary: string; priority: string }>;
  sources: string[];
  confidence: string;
  stats: {
    stepsExecuted: number;
    resultsCollected: number;
    findingsGenerated: number;
  };
};
