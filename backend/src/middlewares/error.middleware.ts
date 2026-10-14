import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { AIProviderError } from "../ai/providers/provider.interface";
import { logger } from "../utils/logger";
import { getRequestId } from "../utils/request-context";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    return next(err);
  }

  const requestId = getRequestId();
  const statusCode = (err as Error & { status?: number }).status;

  if (statusCode === 400 || statusCode === 413) {
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 413 ? "Request body is too large" : "Malformed request body",
      ...(requestId ? { requestId } : {}),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: err.success,
      message: err.message,
      ...(requestId ? { requestId } : {}),
    });
  }

  if (err instanceof AIProviderError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(requestId ? { requestId } : {}),
    });
  }

  logger.error("application.unexpected_error", {
    requestId,
    errorName: err.name,
    errorMessage: err.message,
    stack: err.stack,
  });

  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
    ...(requestId ? { requestId } : {}),
  });
};