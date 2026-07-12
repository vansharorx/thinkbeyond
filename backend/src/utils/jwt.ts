import jwt, { SignOptions } from "jsonwebtoken";
import env from "../config/env";

interface JwtPayload {
  userId: string;
  email: string;
}

export const generateToken = (
  payload: JwtPayload
): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };

  return jwt.sign(
    payload,
    env.JWT_SECRET,
    options
  );
};

export const verifyToken = (
  token: string
): JwtPayload => {
  return jwt.verify(
    token,
    env.JWT_SECRET
  ) as JwtPayload;
};