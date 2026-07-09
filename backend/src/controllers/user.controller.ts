import { Request, Response } from "express";
import prisma from "../config/prisma";
import { successResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export const getUsers = asyncHandler(
  async (req: Request, res: Response) => {

    const users = await prisma.user.findMany();

    return res.json(
      successResponse(
        "Users fetched successfully",
        users
      )
    );

  }
);