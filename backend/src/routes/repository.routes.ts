import { Router } from "express";
import {
  importRepository,
  getRepositoryTree,
  getRepositoryFile,
  getRepositorySymbol,
  searchRepository,
  getRepositoryOverview,
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