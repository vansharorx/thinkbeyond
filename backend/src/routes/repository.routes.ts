import { Router } from "express";
import {
  importRepository,
  getRepositoryTree,
  getRepositoryFile,
  getRepositorySymbol,
  searchRepository,
  getRepositoryOverview,
  navigateRepository,
  getRepositoryImpactAnalysis,
  getRepositoryDependencyAnalysis,
  getRepositorySymbolAnalysis,
  getRepositorySemanticGraphAnalysis,
  getRepositoryReasoning,
  getRepositoryIntelligenceQuery,
  getRepositoryAnswer,
  chatWithRepository,
  explainRepositoryFile,
  explainRepositorySymbol,
  reviewRepositoryArchitecture,
  generateRepositoryDocumentation,
} from "../controllers/repository.controller";

const router = Router();

router.post(
  "/import",
  importRepository
);

router.get(
  "/:id/tree",
  getRepositoryTree
);

router.get(
  "/:id/file",
  getRepositoryFile
);

router.get(
  "/:id/symbol",
  getRepositorySymbol
);

router.get(
  "/:id/search",
  searchRepository
);

router.get(
  "/:id/overview",
  getRepositoryOverview
);

router.post(
  "/:id/navigate",
  navigateRepository
);

router.post(
  "/:id/impact",
  getRepositoryImpactAnalysis
);

router.post(
  "/:id/dependencies",
  getRepositoryDependencyAnalysis
);

router.post(
  "/:id/symbols",
  getRepositorySymbolAnalysis
);

router.post(
  "/:id/graph",
  getRepositorySemanticGraphAnalysis
);

router.post(
  "/:id/reason",
  getRepositoryReasoning
);

router.post(
  "/:id/query",
  getRepositoryIntelligenceQuery
);

router.post(
  "/:id/answer",
  getRepositoryAnswer
);

router.post(
  "/:id/chat",
  chatWithRepository
);

router.post(
  "/:id/explain/file",
  explainRepositoryFile
);

router.post(
  "/:id/explain/symbol",
  explainRepositorySymbol
);

router.post(
  "/:id/review",
  reviewRepositoryArchitecture
);

router.post(
  "/:id/documentation",
  generateRepositoryDocumentation
);

export default router;