import { Router } from "express";
import { importRepository } from "../controllers/repository.controller";

const router = Router();

router.post(
  "/import",
  importRepository
);

export default router;