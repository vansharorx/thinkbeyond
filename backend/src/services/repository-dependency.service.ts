import type { RepositoryExplorerState } from "./repository-explorer-state.service";
import { loadRepositoryExplorerState } from "./repository-explorer-state.service";

export type DependencyOperation =
  | "dependencies"
  | "dependents"
  | "chain"
  | "cycles"
  | "connectivity"
  | "overview";

export interface DependencyRelationship {
  source: string;
  target: string;
  workspace: string;
  relationship: "depends_on" | "used_by";
}

export interface DependencyChain {
  from: string;
  to: string;
  path: string[];
  length: number;
}

export interface DependencyCycleResult {
  workspace: string;
  cycle: string[];
  length: number;
}

export interface DependencyConnectivity {
  dependencyCount: number;
  dependentCount: number;
  totalConnections: number;
  couplingHint: string;
}

export interface DependencyArchitectureContext {
  workspace: string;
  architecture: string;
  patterns: string[];
}

export interface RepositoryDependencyResult {
  target: {
    workspace: string;
    path: string;
  };
  dependencies: DependencyRelationship[];
  dependents: DependencyRelationship[];
  chains: DependencyChain[];
  cycles: DependencyCycleResult[];
  connectivity: DependencyConnectivity;
  architecture: DependencyArchitectureContext[];
}

export interface DependencyRequest {
  filePath?: string;
  from?: string;
  to?: string;
  includeCycles?: boolean;
  operation?: DependencyOperation;
}

export const getRepositoryDependencyIntelligence = async (
  repositoryId: string,
  input: DependencyRequest = {}
): Promise<RepositoryDependencyResult | null> => {
  const state = await loadRepositoryExplorerState(repositoryId);
  if (!state) {
    return null;
  }

  const target = resolveDependencyTarget(state, input);
  if (!target) {
    return null;
  }

  const workspace = findWorkspaceForPath(state, target.path);
  if (!workspace) {
    return null;
  }

  const dependencyNode = workspace.dependencyGraph.nodes.find(node => samePath(node.file, target.path));
  const reverseNode = workspace.reverseDependencyGraph.nodes.find(node => samePath(node.file, target.path));
  const dependencies = dedupeRelationshipList(
    (dependencyNode?.imports ?? []).map(item => ({
      source: target.path,
      target: item,
      workspace: workspace.name,
      relationship: "depends_on",
    }))
  );
  const dependents = dedupeRelationshipList(
    (reverseNode?.usedBy ?? []).map(item => ({
      source: item,
      target: target.path,
      workspace: workspace.name,
      relationship: "used_by",
    }))
  );

  const chains = buildDependencyChains(state, input.from, input.to, target.path);
  const cycleMatches = findDependencyCyclesForFile(state, target.path);

  const connectivity: DependencyConnectivity = {
    dependencyCount: dependencies.length,
    dependentCount: dependents.length,
    totalConnections: dependencies.length + dependents.length,
    couplingHint:
      dependencies.length + dependents.length === 0
        ? "This module has no direct dependency or dependent edges in the indexed graph."
        : dependencies.length + dependents.length <= 3
          ? "This module is lightly connected within the repository graph."
          : dependencies.length + dependents.length <= 8
            ? "This module is moderately connected and may warrant review for architectural coupling."
            : "This module is highly connected; review for architectural coupling and impact radius.",
  };

  const architecture = state.workspaces.map(item => ({
    workspace: item.name,
    architecture: item.architecture.architecture,
    patterns: item.architecture.patterns,
  }));

  return {
    target: {
      workspace: workspace.name,
      path: target.path,
    },
    dependencies,
    dependents,
    chains,
    cycles: input.includeCycles || input.operation === "cycles" ? cycleMatches : [],
    connectivity,
    architecture,
  };
};

export const resolveDependencyTarget = (
  state: RepositoryExplorerState,
  input: DependencyRequest
): { workspace: string; path: string } | null => {
  if (input.filePath) {
    const file = findFileInState(state, input.filePath);
    if (!file) return null;
    return {
      workspace: file.workspace,
      path: file.path,
    };
  }

  if (input.from) {
    const fromFile = findFileInState(state, input.from);
    if (!fromFile) return null;
    return {
      workspace: fromFile.workspace,
      path: fromFile.path,
    };
  }

  if (input.to) {
    const toFile = findFileInState(state, input.to);
    if (!toFile) return null;
    return {
      workspace: toFile.workspace,
      path: toFile.path,
    };
  }

  return null;
};

export const findDependencyChain = (
  state: RepositoryExplorerState,
  fromPath: string,
  toPath: string
): string[] => {
  const normalizedFrom = normalize(fromPath);
  const normalizedTo = normalize(toPath);
  if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) {
    return [];
  }

  const queue: string[][] = [[normalizedFrom]];
  const visited = new Set<string>([normalizedFrom]);

  while (queue.length > 0) {
    const currentPath = queue.shift()!;
    const current = currentPath[currentPath.length - 1];

    if (current === normalizedTo) {
      return currentPath;
    }

    for (const next of getOutgoingDependencies(state, current)) {
      if (visited.has(next)) {
        continue;
      }
      visited.add(next);
      queue.push([...currentPath, next]);
    }
  }

  return [];
};

function buildDependencyChains(
  state: RepositoryExplorerState,
  from?: string,
  to?: string,
  fallbackTarget?: string
): DependencyChain[] {
  const fromPath = from ? findFileInState(state, from)?.path : fallbackTarget;
  const toPath = to ? findFileInState(state, to)?.path : undefined;

  if (!fromPath) {
    return [];
  }

  if (!toPath) {
    const explicitTarget = fallbackTarget ?? fromPath;
    return state.workspaces
      .flatMap(workspace => workspace.dependencyGraph.nodes)
      .filter(node => samePath(node.file, explicitTarget))
      .flatMap(node => node.imports.map(target => ({
        from: explicitTarget,
        to: target,
        path: [explicitTarget, target],
        length: 2,
      })))
      .slice(0, 25);
  }

  const path = findDependencyChain(state, fromPath, toPath);
  if (path.length === 0) {
    return [];
  }

  return [{
    from: fromPath,
    to: toPath,
    path,
    length: path.length,
  }];
}

function findDependencyCyclesForFile(
  state: RepositoryExplorerState,
  filePath: string
): DependencyCycleResult[] {
  const matches: DependencyCycleResult[] = [];

  for (const workspace of state.workspaces) {
    for (const cycle of workspace.circularDependencies.cycles) {
      if (cycle.cycle.some(item => samePath(item, filePath))) {
        matches.push({
          workspace: workspace.name,
          cycle: [...cycle.cycle],
          length: cycle.cycle.length,
        });
      }
    }
  }

  return matches;
}

function findFileInState(
  state: RepositoryExplorerState,
  filePath: string
): { workspace: string; path: string } | null {
  const normalized = normalize(filePath);
  if (!normalized) {
    return null;
  }

  for (const workspace of state.workspaces) {
    for (const sourceFile of workspace.sourceFiles) {
      if (samePath(sourceFile.relativePath, normalized)) {
        return {
          workspace: workspace.name,
          path: sourceFile.relativePath,
        };
      }
    }
  }

  return null;
}

function findWorkspaceForPath(
  state: RepositoryExplorerState,
  filePath: string
): { name: string; dependencyGraph: RepositoryExplorerState["workspaces"][number]["dependencyGraph"]; reverseDependencyGraph: RepositoryExplorerState["workspaces"][number]["reverseDependencyGraph"]; architecture: RepositoryExplorerState["workspaces"][number]["architecture"]; circularDependencies: RepositoryExplorerState["workspaces"][number]["circularDependencies"]; } | null {
  const normalized = normalize(filePath);
  for (const workspace of state.workspaces) {
    if (workspace.sourceFiles.some(sourceFile => samePath(sourceFile.relativePath, normalized))) {
      return workspace;
    }
  }

  return null;
}

function getOutgoingDependencies(
  state: RepositoryExplorerState,
  filePath: string
): string[] {
  const workspace = findWorkspaceForPath(state, filePath);
  if (!workspace) {
    return [];
  }

  const node = workspace.dependencyGraph.nodes.find(item => samePath(item.file, filePath));
  return node?.imports ?? [];
}

function dedupeRelationshipList(
  relationships: DependencyRelationship[]
): DependencyRelationship[] {
  const map = new Map<string, DependencyRelationship>();

  for (const relationship of relationships) {
    const key = `${relationship.source}|${relationship.target}|${relationship.relationship}`;
    if (!map.has(key)) {
      map.set(key, relationship);
    }
  }

  return [...map.values()];
}

function samePath(left: string, right: string): boolean {
  return normalize(left) === normalize(right);
}

function normalize(value: string): string {
  return value.trim().replace(/\\/g, "/").toLowerCase();
}
