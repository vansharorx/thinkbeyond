import prisma from "../config/prisma";

export const createRepository = async (id: string, ownerId: string) => {
  return prisma.repository.create({
    data: {
      id,
      ownerId,
    },
  });
};

export const findRepositoryOwnedByUser = async (
  id: string,
  ownerId: string
) => {
  return prisma.repository.findFirst({
    where: {
      id,
      ownerId,
    },
    select: { id: true },
  });
};