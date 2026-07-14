import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { successResponse } from "../utils/apiResponse";
import { importRepositoryService } from "../services/repository.service";

export const importRepository = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { url } = req.body;

    const repository =
      await importRepositoryService(url);

    return res.status(201).json(
      successResponse(
        "Repository imported successfully",
        repository
      )
    );
  }
);