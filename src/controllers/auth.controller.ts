import { comparePassword, hashPassword } from "../utils/hash";
import { prisma } from "../lib/prisma.js";
import { Request, Response, NextFunction, CookieOptions } from "express";
import { LoginSchema, SignUpSchema } from "../validation/auth.validations";
import {
  BadRequestException,
  ErrorCode,
  InternalException,
  UnauthorizedException,
} from "../utils/root";
import { ApiResponse } from "../utils/apiResponse";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { OtpPurpose } from "@prisma/client";
import { sendEmail } from "../utils/otp";
import {
  VerifyOtpSchema,
  ResendOtpSchema,
} from "../validation/auth.validations";
import { any } from "zod";

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
export const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

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
  //GenerateOtp 
  const otp = generateOtp();
  const otpHash = await hashPassword(otp);
  const otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000);
  
    const newUser = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        otps: {
          create: {
            otp: otpHash,
            expiresAt: otpExpiresAt,
            purpose: OtpPurpose.EMAIL_VERIFICATION,
            type: "EMAIL",
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        otps: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  try {
    await sendEmail(email, otp, OtpPurpose.EMAIL_VERIFICATION);
    
  } catch (error) {
    await prisma.user.delete({
      where: { id: newUser.id },
    });
    throw new InternalException("Failed to send OTP email", ErrorCode.INTERNAL_EXCEPTION);  
  }
    res.status(201).json(new ApiResponse("User registered successfully", newUser));
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
    if(!user.isVerified){
      throw new BadRequestException("User is not verified", ErrorCode.EMAIL_NOT_VERIFIED);
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
        isVerified: true,
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

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, email, otp, purpose } = VerifyOtpSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        otps: {
          where: {
            purpose: purpose as OtpPurpose,
            expiresAt: { gt: new Date() }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!user) {
      throw new BadRequestException("User not found", ErrorCode.USER_NOT_FOUND);
    }

    if (!user.otps || user.otps.length === 0) {
      throw new BadRequestException("OTP expired or not found", ErrorCode.INVALID_CREDENTIALS);
    }

    const latestOtp = user.otps[0];
    const isOtpValid = await comparePassword(otp, latestOtp.otp);

    if (!isOtpValid) {
      throw new BadRequestException("Invalid OTP", ErrorCode.INVALID_CREDENTIALS);
    }

    await prisma.otp.deleteMany({
      where: { userId: user.id, purpose: purpose as OtpPurpose },
    });

    if (purpose === OtpPurpose.EMAIL_VERIFICATION) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true }
      });
      return res.status(200).json(new ApiResponse("Email verified successfully", user));
    }
    
    if (purpose === OtpPurpose.FORGOT_PASSWORD) {
      return res.status(200).json(new ApiResponse("Otp verified successfully, now you can reset your password", user));
    }

    // Default response if purpose is different but OTP was valid
    return res.status(200).json(new ApiResponse("OTP verified successfully", user));
  } catch (error) {
    next(error);
  }
};

export const resendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, email, purpose } = ResendOtpSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new BadRequestException("User not found", ErrorCode.USER_NOT_FOUND);
    }

    if (purpose === OtpPurpose.EMAIL_VERIFICATION && user.isVerified) {
      return res.status(400).json(new ApiResponse("User is already verified", user));
    }

    const otp = generateOtp();
    const otpHash = await hashPassword(otp);
    const otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        otps: {
          create: {
            otp: otpHash,
            expiresAt: otpExpiresAt,
            purpose: purpose as OtpPurpose,
            type: "EMAIL"
          }
        }
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        role: true,
      }
    });

    try {
      await sendEmail(email, otp, purpose as OtpPurpose);
    } catch (emailError) {
      // We don't necessarily want to fail the whole request if email fails to send, 
      // but we should inform the user or at least log it.
      // In this case, since the OTP is generated and saved, they can try resending later.
      throw new InternalException("Failed to send OTP email", ErrorCode.EMAIL_SEND_FAILED, emailError);
    }

    res.status(200).json(new ApiResponse("Otp re-sent successfully", updatedUser));
  } catch (error) {
    next(error);
  }
};

