import jwt, { SignOptions } from "jsonwebtoken";
import env from "../config/env";

interface JwtPayload {
  userId: string;
  email: string;
}

export const generateAccessToken = (
  payload: JwtPayload
): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
  };

  return jwt.sign(
    payload,
    env.JWT_ACCESS_SECRET,
    options
  );
};

export const generateRefreshToken = (
  payload: JwtPayload
): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
  };

  return jwt.sign(
    payload,
    env.JWT_REFRESH_SECRET,
    options
  );
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(
    token,
    env.JWT_ACCESS_SECRET
  ) as JwtPayload;
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(
    token,
    env.JWT_REFRESH_SECRET
  ) as JwtPayload;
};