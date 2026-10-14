import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

const requestStorage = new AsyncLocalStorage<{ requestId: string }>();
const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

export const getRequestId = (): string | undefined => requestStorage.getStore()?.requestId;

export const requestContext = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.header("x-request-id");
  const requestId = incoming && requestIdPattern.test(incoming) ? incoming : randomUUID();

  res.setHeader("X-Request-Id", requestId);
  const startedAt = process.hrtime.bigint();

  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info("http.request", {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });

  requestStorage.run({ requestId }, next);
};