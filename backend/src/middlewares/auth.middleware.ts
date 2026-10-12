import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { verifyAccessToken } from "../services/jwt.service";
import env from "../config/env";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader && env.NODE_ENV === "development") {
    return next();
  }

  if (!authHeader) {
    throw new AppError("Authorization token is missing", 401);
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new AppError("Invalid authorization format", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    return next();
  } catch {
    throw new AppError("Invalid or expired access token", 401);
  }
};