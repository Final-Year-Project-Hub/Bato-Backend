import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { createAndSendOtp } from "../utils/otp";


export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  emailVerification: {
    sendVerificationEmail: async ({ user }) => {
        try {
          console.log("Attempting to send OTP to", user.email);
        // Send 6-digit OTP instead of verification link
        await createAndSendOtp(user.id, user.email, user.name);
        console.log("Successfully sent OTP to", user.email);
      } catch (error) {
        console.error("DEBUG: Failed to send OTP for user:", user.id, error);
        throw new Error("Failed to send verification email");
      }
    },
    expiresIn: 60 * 10, // 10 minutes
  },

  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4000",
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:4000",
  ],
  advanced: {
    disableOriginCheck: true, // Allow requests without Origin header (e.g. from Postman)
  },
  logger: {
    level: "debug",
  },
});

export { prisma };