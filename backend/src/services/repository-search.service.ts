import { loadRepositoryExplorerState } from "./repository-explorer-state.service";
import { searchRepositoryExplorer, type RepositorySearchOptions, type RepositorySearchResponse } from "../analysis/search/search.service";

export const searchRepositoryData = async (
  repositoryId: string,
  query: string,
  options: RepositorySearchOptions = {}
): Promise<RepositorySearchResponse | null> => {
  const state = await loadRepositoryExplorerState(repositoryId);
  if (!state) {
    return null;
  }

  return searchRepositoryExplorer(state.workspaces, query, options);
};
