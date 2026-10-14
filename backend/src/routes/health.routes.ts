import { Router } from "express";
import { successResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { checkDatabaseReadiness } from "../services/health.service";

const router = Router();

router.get("/health", (req, res) => {
  return res.status(200).json(
    successResponse("ThinkBeyond API is healthy", {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })
  );
});

router.get("/health/live", (req, res) => {
  return res.status(200).json(
    successResponse("ThinkBeyond API is alive", {
      status: "alive",
      timestamp: new Date().toISOString(),
    })
  );
});

router.get("/health/ready", asyncHandler(async (_req, res) => {
  const readiness = await checkDatabaseReadiness();

  if (!readiness.ready) {
    return res.status(503).json({
      success: false,
      message: "Service unavailable",
      data: { status: "not_ready" },
    });
  }

  return res.status(200).json(
    successResponse("ThinkBeyond API is ready", {
      status: "ready",
      timestamp: new Date().toISOString(),
    })
  );
}));

export default router;