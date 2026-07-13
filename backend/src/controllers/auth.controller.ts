import { Request } from "express";
import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { successResponse } from "../utils/apiResponse";
import { registerUser } from "../services/auth.service";
import { toUserResponse } from "../mappers/user.mapper";
import { loginUser } from "../services/auth.service";
import { refreshAccessToken } from "../services/refresh.service";

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

    const {
      user,
      accessToken,
      refreshToken,
    } = await loginUser(
      email,
      password
    );

    return res.status(200).json(
      successResponse(
        "Login successful",
        {
          user: toUserResponse(user),
          accessToken,
          refreshToken,
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

export const refresh = asyncHandler(
  async (req: AuthRequest, res: Response) => {

    const { refreshToken } = req.body;

    const accessToken =
      await refreshAccessToken(refreshToken);

    return res.status(200).json(
      successResponse(
        "Access token refreshed",
        {
          accessToken,
        }
      )
    );
  }
);