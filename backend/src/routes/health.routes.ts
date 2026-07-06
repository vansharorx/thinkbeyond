import { Router } from "express";
import { successResponse } from "../utils/apiResponse";

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

export default router;