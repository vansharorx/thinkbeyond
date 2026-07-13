import { AppError } from "../utils/AppError";
import {
  findRefreshToken,
} from "../repositories/refreshToken.repository";
import {
  generateAccessToken,
  verifyRefreshToken,
} from "./jwt.service";

export const refreshAccessToken = async (
  refreshToken: string
) => {
  // Verify JWT
  const payload = verifyRefreshToken(refreshToken);

  // Check Database
  const storedToken = await findRefreshToken(refreshToken);

  if (!storedToken) {
    throw new AppError(
      "Invalid refresh token",
      401
    );
  }

  // Check Expiry
  if (storedToken.expiresAt < new Date()) {
    throw new AppError(
      "Refresh token expired",
      401
    );
  }

  // Generate New Access Token
  const accessToken = generateAccessToken({
    userId: payload.userId,
    email: payload.email,
  });

  return accessToken;
};