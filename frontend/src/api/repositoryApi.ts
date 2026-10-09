import type {
  ApiEnvelope,
  RepositoryAnswerResult,
  RepositoryId,
  RepositoryInvestigationResult,
  RepositoryOverview,
  RepositoryResource,
  RepositorySearchResponse,
  RepositoryTreeResponse,
} from '../types/repository';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:5000/api/v1';
const REPOSITORY_BASE = `${API_BASE}/repositories`;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${REPOSITORY_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as ApiEnvelope<T>) : ({} as ApiEnvelope<T>);

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message ?? `Request failed (${response.status})`);
  }

  return (payload.data ?? (payload as unknown as T)) as T;
}

function jsonBody(value: Record<string, unknown>) {
  return JSON.stringify(value);
}

export const repositoryApi = {
  importRepository: async (url: string) =>
    request<{ id?: string; repositoryId?: string; url?: string }>(`/import`, {
      method: 'POST',
      body: jsonBody({ url }),
    }),

  getOverview: async (repositoryId: RepositoryId) =>
    request<RepositoryOverview>(`/${repositoryId}/overview`),

  getTree: async (repositoryId: RepositoryId, relativePath = '', recursive = true) =>
    request<RepositoryTreeResponse>(`/${repositoryId}/tree?path=${encodeURIComponent(relativePath)}&recursive=${String(recursive)}`),

  getFile: async (repositoryId: RepositoryId, filePath: string) =>
    request<RepositoryResource>(`/${repositoryId}/file?path=${encodeURIComponent(filePath)}`),

  search: async (repositoryId: RepositoryId, query: string, scope = 'all') =>
    request<RepositorySearchResponse>(`/${repositoryId}/search?q=${encodeURIComponent(query)}&scope=${encodeURIComponent(scope)}&match=partial`),

  getSymbol: async (repositoryId: RepositoryId, symbolName: string, match = 'partial') =>
    request<RepositoryResource>(`/${repositoryId}/symbol?name=${encodeURIComponent(symbolName)}&match=${match}`),

  getDependencies: async (repositoryId: RepositoryId, input: Record<string, unknown> = {}) =>
    request<{ target?: { workspace?: string; path?: string }; dependencies?: unknown[]; dependents?: unknown[]; cycles?: unknown[]; connectivity?: Record<string, unknown>; architecture?: unknown[] }>(`/${repositoryId}/dependencies`, {
      method: 'POST',
      body: jsonBody(input),
    }),

  getImpact: async (repositoryId: RepositoryId, input: Record<string, unknown> = {}) =>
    request<Record<string, unknown>>(`/${repositoryId}/impact`, {
      method: 'POST',
      body: jsonBody(input),
    }),

  getGraph: async (repositoryId: RepositoryId, input: Record<string, unknown> = {}) =>
    request<Record<string, unknown>>(`/${repositoryId}/graph`, {
      method: 'POST',
      body: jsonBody(input),
    }),

  answer: async (repositoryId: RepositoryId, question: string, operation = 'answer') =>
    request<RepositoryAnswerResult>(`/${repositoryId}/answer`, {
      method: 'POST',
      body: jsonBody({ question, operation }),
    }),

  investigate: async (repositoryId: RepositoryId, query: string, maxSteps = 5) =>
    request<RepositoryInvestigationResult>(`/${repositoryId}/investigate`, {
      method: 'POST',
      body: jsonBody({ query, maxSteps }),
    }),

  chat: async (repositoryId: RepositoryId, message: string) =>
    request<Record<string, unknown>>(`/${repositoryId}/chat`, {
      method: 'POST',
      body: jsonBody({ message }),
    }),

  explainFile: async (repositoryId: RepositoryId, filePath: string, question: string) =>
    request<Record<string, unknown>>(`/${repositoryId}/explain/file`, {
      method: 'POST',
      body: jsonBody({ filePath, question }),
    }),

  explainSymbol: async (repositoryId: RepositoryId, symbolName: string, question: string) =>
    request<Record<string, unknown>>(`/${repositoryId}/explain/symbol`, {
      method: 'POST',
      body: jsonBody({ symbolName, question }),
    }),

  reason: async (repositoryId: RepositoryId, question: string) =>
    request<Record<string, unknown>>(`/${repositoryId}/reason`, {
      method: 'POST',
      body: jsonBody({ question }),
    }),

  query: async (repositoryId: RepositoryId, operation: string, query?: string) =>
    request<Record<string, unknown>>(`/${repositoryId}/query`, {
      method: 'POST',
      body: jsonBody({ operation, query }),
    }),

  navigate: async (repositoryId: RepositoryId, query: string) =>
    request<Record<string, unknown>>(`/${repositoryId}/navigate`, {
      method: 'POST',
      body: jsonBody({ query }),
    }),

  review: async (repositoryId: RepositoryId) =>
    request<Record<string, unknown>>(`/${repositoryId}/review`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  documentation: async (repositoryId: RepositoryId) =>
    request<Record<string, unknown>>(`/${repositoryId}/documentation`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};

export function getRepositoryIdFromPayload(payload: { id?: string; repositoryId?: string } | null | undefined): string | undefined {
  return payload?.id ?? payload?.repositoryId;
}
