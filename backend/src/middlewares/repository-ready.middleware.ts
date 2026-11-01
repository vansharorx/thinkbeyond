import { NextFunction, Response } from "express";
import { AppError } from "../utils/AppError";
import { AuthRequest } from "./auth.middleware";

export const requireReadyRepository = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  if (req.repository?.status !== "ready") {
    throw new AppError("Repository analysis is not ready", 409);
  }

  return next();
};