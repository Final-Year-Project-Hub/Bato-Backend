import { NextFunction, Request, Response } from "express";
import { UnauthorizedException, ErrorCode, InternalException } from "../utils/root";
import { prisma } from "../lib/prisma.js";
import jwt, { JwtPayload } from "jsonwebtoken";
import { generateAccessandRefreshToken } from "../controllers/auth.controller";
import { comparePassword } from "../utils/hash";

interface TokenPayload extends JwtPayload {
  data: {
    id: string;
    email: string;
    role: string;
  };
}

export const verifyUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const accessToken =
      req.cookies.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!accessToken) {
      throw new UnauthorizedException(
        "Unauthorized. No access token provided",
        ErrorCode.UNAUTHORIZED_REQUEST
      );
    }

    try {
      const decoded = jwt.verify(
        accessToken,
        process.env.ACCESS_TOKEN_SECRET!
      ) as TokenPayload;

      const user = await prisma.user.findUnique({
        where: { id: decoded.data.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException(
          "User not found",
          ErrorCode.UNAUTHORIZED_REQUEST
        );
      }

      (req as any).user = user;
      return next();
    } catch (error: any) {
      if (error.name !== "TokenExpiredError") {
        throw new UnauthorizedException(
          "Invalid access token",
          ErrorCode.UNAUTHORIZED_REQUEST
        );
      }
    }

    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException(
        "Session expired. Please login again.",
        ErrorCode.UNAUTHORIZED_REQUEST
      );
    }

    const decodedRefresh = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET!
    ) as TokenPayload;

    const user = await prisma.user.findUnique({
      where: { id: decodedRefresh.data.id },
    });

    if (!user || !(await comparePassword(refreshToken, user.refreshToken as string))) {
      throw new UnauthorizedException(
        "Invalid refresh token",
        ErrorCode.UNAUTHORIZED_REQUEST
      );
    }

    const {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    } = await generateAccessandRefreshToken(user);

    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
    };

    res.cookie("accessToken", newAccessToken, cookieOptions);
    res.cookie("refreshToken", newRefreshToken, cookieOptions);

    (req as any).user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};