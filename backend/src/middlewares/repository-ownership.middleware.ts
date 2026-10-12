import { NextFunction, Response } from "express";
import { AuthRequest } from "./auth.middleware";
import { AppError } from "../utils/AppError";
import { findRepositoryOwnedByUser } from "../repositories/repository.repository";

export const authorizeRepository = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    throw new AppError("Authorization token is missing", 401);
  }

  const repositoryId = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  const repository = await findRepositoryOwnedByUser(
    repositoryId ?? "",
    req.user.userId
  );

  if (!repository) {
    // Keep nonexistent and cross-user repositories indistinguishable.
    throw new AppError("Repository not found", 404);
  }

  return next();
};