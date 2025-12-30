import { hashPassword, comparePassword } from "../../utils/hash.js";
import prisma from "../../prisma.js";
import { User } from "../../../generated/prisma/client.js";

export const signUp = async (
  fullName: string,
  email: string,
  password: string
): Promise<User | null> => {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) return null;

  const hashedPassword = await hashPassword(password);

  const newUser = await prisma.user.create({
    data: {
      fullName,
      email,
      password: hashedPassword,
    },
  });

  return newUser;
};
