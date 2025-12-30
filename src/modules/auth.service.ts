import { hashPassword, comparePassword } from "../utils/hash";
import { prisma } from "../../lib/prisma.js";

export const signUp = async (
  fullName: string,
  email: string,
  password: string
) => {
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