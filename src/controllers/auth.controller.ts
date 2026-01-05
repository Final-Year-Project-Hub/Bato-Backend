import { comparePassword, hashPassword } from "../utils/hash";
import { prisma } from "../lib/prisma.js";
import { Request, Response, NextFunction, CookieOptions } from "express";
import { LoginSchema, SignUpSchema } from "../validation/auth.validations";
import {
  BadRequestException,
  ErrorCode,
  UnauthorizedException,
} from "../utils/root";
import { ApiResponse } from "../utils/apiResponse";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";

export const generateAccessandRefreshToken = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    throw new BadRequestException("User not found", ErrorCode.USER_NOT_FOUND);
  }
  const accessToken = generateAccessToken({
    id: user.id,
    role: user.role,
    email: user.email,
  });
  const refreshToken = generateRefreshToken({
    id: user.id,
    role: user.role,
    email: user.email,
  });
  const hashedRefreshToken = await hashPassword(refreshToken);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: hashedRefreshToken },
  });
  return { accessToken, refreshToken };
};
export const signUp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { email, password, fullName } = SignUpSchema.parse(
    req.body
  );

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new BadRequestException(
      "User already exists",
      ErrorCode.USER_ALREADY_EXISTS
    );
  }

  const hashedPassword = await hashPassword(password);


  const newUser = await prisma.user.create({
    data: {
      fullName,
      email,
      password: hashedPassword,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  res
    .status(201)
    .json(new ApiResponse("User Registered Successfully", newUser));
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { email, password } = LoginSchema.parse(req.body);
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new BadRequestException("User not found", ErrorCode.USER_NOT_FOUND);
    }
    const passwordMatch = await comparePassword(password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException(
        "Password does not match",
        ErrorCode.INVALID_CREDENTIALS
      );
    }
    const { accessToken, refreshToken } = await generateAccessandRefreshToken(
      user.id
    );
    const loggedInUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        role: true,
      },
    });
    const cookieOptions: CookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    };
    res
      .status(200)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .cookie("role", user.role.trim(), cookieOptions) // Set role in a cookie
      .json(
        new ApiResponse("User logged in successfully", {
          user: loggedInUser,
          accessToken,
          refreshToken,
        })
      );
  } catch (error) {
    next(error);
  }
};
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: null },
      });
    } else {
      throw new UnauthorizedException(
        "User not found",
        ErrorCode.UNAUTHORIZED_REQUEST
      );
    }

    const cookieOptions: CookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    };

    res
      .status(200)
      .clearCookie("accessToken", cookieOptions)
      .clearCookie("refreshToken", cookieOptions)
      .clearCookie("role", cookieOptions)
      .json(new ApiResponse("User logged out successfully", user));
  } catch (error) {
    next(error);
  }
};
