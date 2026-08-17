import { loadRepositoryExplorerState } from "../../services/repository-explorer-state.service";
import { buildAiContext } from "../context/context-builder.service";
import { retrieveRepositoryContext } from "../rag/retrieval.service";
import { runAiTask } from "./ai-runner.service";

export interface RepositoryChatResponse {
  repositoryId: string;
  question: string;
  provider: string;
  answer: string;
  context: Awaited<ReturnType<typeof buildAiContext>>;
  retrieval: ReturnType<typeof retrieveRepositoryContext>;
}

export const chatRepository = async (
  repositoryId: string,
  question: string
): Promise<RepositoryChatResponse | null> => {
  const state = await loadRepositoryExplorerState(repositoryId);
  if (!state) {
    return null;
  }

  const context = await buildAiContext(state);
  const retrieval = retrieveRepositoryContext(state, question);
  const prompt = await runAiTask("explainRepository", {
    repository: context.repository,
    retrieval,
  }, question);

  return {
    repositoryId,
    question,
    provider: prompt.provider,
    answer: prompt.content,
    context,
    retrieval,
  };
};
