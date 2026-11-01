import { cloneRepository } from "./git.service";
import { scanRepository } from "./scanner.service";
import { generateManifest } from "./manifest.service";
import { analyzeReadme } from "./readme.service";
import { analyzePackage } from "./package-analyzer.service";
import { detectArchitecture } from "./architecture.service";
import { analyzeWorkspaces } from "./workspace.service";
import { generateRepositorySummary } from "./repository-summary.service";
import { buildRepositoryKnowledge } from "./repository-knowledge.service";
import { saveRepositoryExplorerState } from "./repository-explorer-state.service";
import { ensureRepositoryRootPath } from "./repository-explorer-state.service";

export const runRepositoryAnalysis = async (
  repositoryId: string,
  _ownerId: string,
  repositoryUrl: string,
  onPhase: (phase: string) => Promise<void>,
  options?: { attemptPath: string; attemptId?: string; assertActive: () => void }
) => {
  const analysisPath = options?.attemptPath ?? await ensureRepositoryRootPath(repositoryId, true);
  const assertActive = options?.assertActive ?? (() => undefined);
  assertActive();
  const repository = await cloneRepository(repositoryId, repositoryUrl, analysisPath);
  await onPhase("scanning");
  assertActive();
  const scan = await scanRepository(repository.path);

  await onPhase("metadata");
  assertActive();
  await generateManifest(repository.path);
  await analyzeReadme(repository.path);
  await analyzePackage(repository.path);
  await detectArchitecture(repository.path, scan.directories);

  await onPhase("indexing");
  assertActive();
  const workspaces = await analyzeWorkspaces(repository.path, scan.directories);

  await onPhase("graphs");
  assertActive();
  const summary = generateRepositorySummary(workspaces);
  const knowledge = buildRepositoryKnowledge(workspaces);
  const { analyzeImpact: _analyzeImpact, ...knowledgeSnapshot } = knowledge;

  await onPhase("snapshot");
  assertActive();
  await saveRepositoryExplorerState({
    repositoryId,
    repositoryPath: repository.path,
    summary,
    knowledge: knowledgeSnapshot,
    workspaces,
  }, { storagePath: analysisPath, assertActive });
};