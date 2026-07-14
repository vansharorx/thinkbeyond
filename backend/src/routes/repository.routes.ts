import { Router } from "express";
import { importRepository } from "../controllers/repository.controller";
import { importRepositoryValidation } from "../validators/repository.validator";
import { validate } from "../middlewares/validation.middleware";

const router = Router();

router.post(
  "/import",
  importRepositoryValidation,
  validate,
  importRepository
);

export default router;