import { Router } from "express";

import { register } from "../controllers/auth.controller";

import { validate } from "../middlewares/validation.middleware";

import { registerSchema } from "../validators/auth.validator";

const router = Router();

router.post(
  "/register",
  validate(registerSchema),
  register
);

export default router;