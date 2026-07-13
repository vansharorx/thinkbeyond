import bcrypt from "bcrypt";
import { AppError } from "../utils/AppError";
import { createUser, findUserByEmail } from "../repositories/user.repository";
import { generateAccessToken, generateRefreshToken, } from "./jwt.service";
import { createRefreshToken } from "../repositories/refreshToken.repository";

const SALT_ROUNDS = 10;

export const registerUser = async (
  name: string,
  email: string,
  password: string
) => {
  // Check if user already exists
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw new AppError("User already exists", 409);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Save user
  const user = await createUser(
    name,
    email,
    hashedPassword
  );

  return user;
};

export const loginUser = async (
  email: string,
  password: string
) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    user.password
  );

  if (!isPasswordValid) {
    throw new AppError("Invalid email or password", 401);
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
  });

  const refreshToken = generateRefreshToken({
    userId: user.id,
    email: user.email,
  });

  const refreshTokenExpiry = new Date();
  refreshTokenExpiry.setDate(
    refreshTokenExpiry.getDate() + 7
  );

  await createRefreshToken(
    refreshToken,
    user.id,
    refreshTokenExpiry
  );

  return {
    user,
    accessToken,
    refreshToken,
  };
  
};