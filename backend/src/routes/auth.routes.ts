import { Router } from "express";

import { login } from "../controllers/auth.controller";

import { validate } from "../middlewares/validation.middleware";

import { loginSchema } from "../validators/auth.validator";

const router = Router();

router.post(
  "/login",
  validate(loginSchema),
  login
);

export default router;