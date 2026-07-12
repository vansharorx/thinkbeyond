import { Request } from "express";
import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
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

    const { user, token } = await loginUser(
      email,
      password
    );

    return res.status(200).json(
      successResponse(
        "Login successful",
        {
          user: toUserResponse(user),
          accessToken: token,
        }
      )
    );
  }
);

export const getProfile = asyncHandler(
  async (req: AuthRequest, res: Response) => {

    return res.status(200).json(
      successResponse(
        "Profile fetched successfully",
        req.user
      )
    );

  }
);