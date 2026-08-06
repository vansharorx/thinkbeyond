import { Router } from "express";
import {
  importRepository,
  getRepositoryTree,
  getRepositoryFile,
  getRepositorySymbol,
  searchRepository,
  getRepositoryOverview,
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

export default router;