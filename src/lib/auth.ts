import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { createAndSendOtp } from "../utils/otp";

// Safety check (VERY important in prod)
if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is not defined");
}

if (!process.env.BETTER_AUTH_URL) {
  throw new Error("BETTER_AUTH_URL is not defined");
}

export const auth = betterAuth({
  // 1️⃣ Database (Prisma)
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // 2️⃣ Email + Password Auth
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: true,
  },

  // 3️⃣ Custom Email Verification (OTP-based)
  emailVerification: {
    sendVerificationEmail: async ({ user }) => {
      try {
        console.log("[AUTH] Sending OTP to:", user.email);
        await createAndSendOtp(user.id, user.email, user.name);
      } catch (error) {
        console.error("[AUTH] OTP send failed:", error);
        throw new Error("Failed to send verification email");
      }
    },
    expiresIn: 60 * 10, // 10 minutes
  },

  // 4️⃣ Backend URL (THIS MUST BE BACKEND, NOT FRONTEND)
  baseURL: process.env.BETTER_AUTH_URL,

  // 5️⃣ Allowed Frontend Origins
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://frontend-test-seven-xi.vercel.app",
    "https://frontend-test-kuber-pathaks-projects.vercel.app",
  ],

  // 6️⃣ Secret (used for sessions & crypto)
  secret: process.env.BETTER_AUTH_SECRET,

  // 7️⃣ Advanced (Dev-only relaxations)
  advanced: {
    disableOriginCheck: process.env.NODE_ENV === "development",
    disableCSRFCheck: process.env.NODE_ENV === "development",
  },

  // 8️⃣ Logging
  logger: {
    level: process.env.NODE_ENV === "development" ? "debug" : "error",
  },
});

export { prisma };
