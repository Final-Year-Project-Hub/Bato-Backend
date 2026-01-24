import jwt from "jsonwebtoken";
import { InternalException, ErrorCode } from "./root";
import dotenv from "dotenv";
import { CookieOptions } from "express";
dotenv.config();


export interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

export const generateAccessToken = (user: JwtPayload) => {
  try {
    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!secret) {
      throw new Error("ACCESS_TOKEN_SECRET is not defined in environment variables");
    }
    return jwt.sign(
      {
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
      secret,
      { expiresIn: "5m" }
    );
  } catch (error: any) {
    console.error("JWT Generation Error (Access):", error);
    throw new InternalException("Failed to generate access token", ErrorCode.INTERNAL_EXCEPTION, error.message || error);
  }
};

export const generateRefreshToken = (user: JwtPayload) => {
  try {
    const secret = process.env.REFRESH_TOKEN_SECRET;
    if (!secret) {
      throw new Error("REFRESH_TOKEN_SECRET is not defined in environment variables");
    }
    return jwt.sign(
      {
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
      secret,
      { expiresIn: "7d" }
    );
  } catch (error: any) {
    console.error("JWT Generation Error (Refresh):", error);
    throw new InternalException("Failed to generate refresh token", ErrorCode.INTERNAL_EXCEPTION, error.message || error);
  }
};

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // ✅ only https in prod
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};