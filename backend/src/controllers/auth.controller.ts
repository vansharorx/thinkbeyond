import { Request, Response } from "express";
import { successResponse } from "../utils/apiResponse";

export const login = (
  req: Request,
  res: Response
) => {
  return res.status(200).json(
    successResponse(
      "Login request validated successfully",
      req.body
    )
  );
};