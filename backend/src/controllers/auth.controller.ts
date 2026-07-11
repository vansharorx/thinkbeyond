import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { successResponse } from "../utils/apiResponse";
import { registerUser } from "../services/auth.service";
import { toUserResponse } from "../mappers/user.mapper";
import { loginUser } from "../services/auth.service";

export const register = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, email, password } = req.body;

    const user = await registerUser(
      name,
      email,
      password
    );

    return res.status(201).json(
      successResponse(
        "User registered successfully",
        toUserResponse(user)
      )
    );
  }
);

export const login = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const user = await loginUser(
      email,
      password
    );

    return res.status(200).json(
      successResponse(
        "Login successful",
        toUserResponse(user)
      )
    );
  }
);