import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { AIProviderError } from "../ai/providers/provider.interface";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: err.success,
      message: err.message,
    });
  }

  if (err instanceof AIProviderError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  console.error("Unexpected Error:", err);

  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
};