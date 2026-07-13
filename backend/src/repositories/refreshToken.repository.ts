import prisma from "../config/prisma";

export const createRefreshToken = async (
  token: string,
  userId: string,
  expiresAt: Date
) => {
  return prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });
};

export const findRefreshToken = async (
  token: string
) => {
  return prisma.refreshToken.findUnique({
    where: {
      token,
    },
  });
};

export const deleteRefreshToken = async (
  token: string
) => {
  return prisma.refreshToken.delete({
    where: {
      token,
    },
  });
};

export const deleteAllRefreshTokens = async (
  userId: string
) => {
  return prisma.refreshToken.deleteMany({
    where: {
      userId,
    },
  });
};