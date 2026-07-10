import bcrypt from "bcrypt";
import { AppError } from "../utils/AppError";
import { createUser, findUserByEmail } from "../repositories/user.repository";

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