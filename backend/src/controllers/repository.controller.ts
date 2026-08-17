import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { successResponse } from "../utils/apiResponse";
import { importRepositoryService } from "../services/repository.service";
import { AppError } from "../utils/AppError";
import { loadRepositoryExplorerState } from "../services/repository-explorer-state.service";
import { buildRepositoryTree } from "../services/repository-tree.service";
import { getRepositoryFileDetails } from "../services/repository-file.service";
import { getSymbolDetails } from "../services/symbol-explorer.service";
import { searchRepositoryData } from "../services/repository-search.service";
import { getRepositoryOverview as loadRepositoryOverview } from "../services/repository-overview.service";
import { chatRepository } from "../ai/chat/repository-chat.service";
import { explainFile } from "../ai/chat/explain-file.service";
import { explainSymbol } from "../ai/chat/explain-symbol.service";
import { reviewArchitecture } from "../ai/chat/architecture-review.service";
import { generateDocumentation } from "../ai/chat/documentation.service";

export const importRepository = asyncHandler(
  async (req: Request, res: Response) => {
    const { url } = req.body;

    const repository =
      await importRepositoryService(url);

    return res.status(201).json(
      successResponse(
        "Repository imported successfully",
        repository
      )
    );
  }
);

export const getRepositoryTree = asyncHandler(
  async (req: Request, res: Response) => {
    const repositoryId = firstString(req.params.id);
    const state = await loadRepositoryExplorerState(repositoryId);

    if (!state) {
      throw new AppError("Repository not found", 404);
    }

    const relativePath = firstOptionalString(req.query.path);
    const recursive = firstOptionalString(req.query.recursive) !== "false";
    const depthValue = firstOptionalString(req.query.depth);
    const depth = depthValue ? Number(depthValue) : undefined;

    const tree = await buildRepositoryTree(state.repositoryPath, {
      relativePath,
      recursive,
      maxDepth: Number.isFinite(depth) ? depth : undefined,
    });

    return res.json(
      successResponse("Repository tree loaded successfully", {
        repositoryId,
        path: relativePath ?? ".",
        tree,
      })
    );
  }
);

export const getRepositoryFile = asyncHandler(
  async (req: Request, res: Response) => {
    const repositoryId = firstString(req.params.id);
    const filePath = firstOptionalString(req.query.path) ?? "";

    const file = await getRepositoryFileDetails(repositoryId, filePath);

    if (!file) {
      throw new AppError("File not found", 404);
    }

    return res.json(
      successResponse("Repository file loaded successfully", file)
    );
  }
);

export const getRepositorySymbol = asyncHandler(
  async (req: Request, res: Response) => {
    const repositoryId = firstString(req.params.id);
    const query = firstOptionalString(req.query.name) ?? "";
    const matchMode = firstOptionalString(req.query.match) === "partial" ? "partial" : "exact";

    const symbol = await getSymbolDetails(repositoryId, query, matchMode);

    if (!symbol) {
      throw new AppError("Repository not found", 404);
    }

    return res.json(
      successResponse("Repository symbol loaded successfully", symbol)
    );
  }
);

export const searchRepository = asyncHandler(
  async (req: Request, res: Response) => {
    const repositoryId = firstString(req.params.id);
    const query = firstOptionalString(req.query.q) ?? "";
    const scope = firstOptionalString(req.query.scope);
    const matchMode = firstOptionalString(req.query.match) === "exact" ? "exact" : "partial";

    const validScope =
      scope === "files" ||
      scope === "symbols" ||
      scope === "functions" ||
      scope === "classes" ||
      scope === "interfaces" ||
      scope === "enums" ||
      scope === "variables" ||
      scope === "typeAliases" ||
      scope === "all"
        ? scope
        : undefined;

    const results = await searchRepositoryData(repositoryId, query, {
      scope: validScope,
      matchMode,
    });

    if (!results) {
      throw new AppError("Repository not found", 404);
    }

    return res.json(
      successResponse("Repository search completed successfully", {
        repositoryId,
        query,
        results,
      })
    );
  }
);

export const getRepositoryOverview = asyncHandler(
  async (req: Request, res: Response) => {
    const repositoryId = firstString(req.params.id);

    const overview = await loadRepositoryOverview(repositoryId);

    if (!overview) {
      throw new AppError("Repository not found", 404);
    }

    return res.json(
      successResponse("Repository overview loaded successfully", overview)
    );
  }
);

export const chatWithRepository = asyncHandler(
  async (req: Request, res: Response) => {
    const repositoryId = firstString(req.params.id);
    const question = firstOptionalString(req.body?.question) ?? "";

    const result = await chatRepository(repositoryId, question);

    if (!result) {
      throw new AppError("Repository not found", 404);
    }

    return res.json(
      successResponse("Repository chat completed successfully", result)
    );
  }
);

export const explainRepositoryFile = asyncHandler(
  async (req: Request, res: Response) => {
    const repositoryId = firstString(req.params.id);
    const filePath = firstOptionalString(req.body?.filePath) ?? firstOptionalString(req.query.path) ?? "";

    const result = await explainFile(repositoryId, filePath);

    if (!result) {
      throw new AppError("File not found", 404);
    }

    return res.json(
      successResponse("File explanation completed successfully", result)
    );
  }
);

export const explainRepositorySymbol = asyncHandler(
  async (req: Request, res: Response) => {
    const repositoryId = firstString(req.params.id);
    const symbolName = firstOptionalString(req.body?.symbolName) ?? firstOptionalString(req.query.name) ?? "";
    const matchMode = firstOptionalString(req.body?.matchMode) === "partial" ? "partial" : "exact";

    const result = await explainSymbol(repositoryId, symbolName, matchMode);

    if (!result) {
      throw new AppError("Symbol not found", 404);
    }

    return res.json(
      successResponse("Symbol explanation completed successfully", result)
    );
  }
);

export const reviewRepositoryArchitecture = asyncHandler(
  async (req: Request, res: Response) => {
    const repositoryId = firstString(req.params.id);

    const result = await reviewArchitecture(repositoryId);

    if (!result) {
      throw new AppError("Repository not found", 404);
    }

    return res.json(
      successResponse("Architecture review completed successfully", result)
    );
  }
);

export const generateRepositoryDocumentation = asyncHandler(
  async (req: Request, res: Response) => {
    const repositoryId = firstString(req.params.id);
    const scope = firstOptionalString(req.body?.scope) as "repository" | "architecture" | "api" | "module" | undefined;

    const result = await generateDocumentation(repositoryId, scope ?? "repository");

    if (!result) {
      throw new AppError("Repository not found", 404);
    }

    return res.json(
      successResponse("Documentation generated successfully", result)
    );
  }
);

function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function firstOptionalString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value[0] as string | undefined;
  }

  return typeof value === "string" ? value : undefined;
}