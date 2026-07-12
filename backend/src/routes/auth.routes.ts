import { Router } from "express";

import {
  register,
  login,
  getProfile,
} from "../controllers/auth.controller";

import { validate } from "../middlewares/validation.middleware";

import {
  registerSchema,
  loginSchema,
} from "../validators/auth.validator";

import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.post(
  "/register",
  validate(registerSchema),
  register
);

router.post(
  "/login",
  validate(loginSchema),
  login
);

router.get(
  "/profile",
  authenticate,
  getProfile
);

export default router;