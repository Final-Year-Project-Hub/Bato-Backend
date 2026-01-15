import { comparePassword, hashPassword } from "../utils/hash";
import { createAndSendOtp } from "../utils/otp";
import { prisma } from "../lib/auth";
import { Request, Response, NextFunction, CookieOptions } from "express";
import { LoginSchema, SignUpSchema } from "../validation/auth.validations";
import {
  BadRequestException,
  ErrorCode,
  InternalException
} from "../utils/root";
import { ApiResponse } from "../utils/apiResponse";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { OtpPurpose } from "@prisma/client";
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

// export const signUp = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   const { email, password, fullName } = SignUpSchema.parse(
//     req.body
//   );
//     const existingUser = await prisma.user.findUnique({
//       where: { email },
//     });
  
//     if (existingUser) {
//       throw new BadRequestException(
//         "User already exists",
//         ErrorCode.USER_ALREADY_EXISTS
//       );
//     }
  
//     const hashedPassword = await hashPassword(password);
//   //GenerateOtp 
//   const otp = generateOtp();
//   const otpHash = await hashPassword(otp);
//   const otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000);
  
//     const newUser = await prisma.user.create({
//       data: {
//         fullName,
//         email,
//         password: hashedPassword,
//         otps: {
//           create: {
//             otp: otpHash,
//             expiresAt: otpExpiresAt,
//             purpose: OtpPurpose.EMAIL_VERIFICATION,
//             type: "EMAIL",
//           },
//         },
//       },
//       select: {
//         id: true,
//         fullName: true,
//         email: true,
//         otps: true,
//         createdAt: true,
//         updatedAt: true,
//       },
//     });
//   try {
//     await sendEmail(email, otp, OtpPurpose.EMAIL_VERIFICATION);
    
//   } catch (error) {
//     await prisma.user.delete({
//       where: { id: newUser.id },
//     });
//     throw new InternalException("Failed to send OTP email", ErrorCode.INTERNAL_EXCEPTION);  
//   }
//     res.status(201).json(new ApiResponse("User registered successfully", newUser));
//   };

// export const login = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   const { email, password } = LoginSchema.parse(req.body);
//   try {
//     const user = await prisma.user.findUnique({
//       where: { email },
//     });
//     if (!user) {
//       throw new BadRequestException("User not found", ErrorCode.USER_NOT_FOUND);
//     }
//     if(!user.isVerified){
//       throw new BadRequestException("User is not verified", ErrorCode.EMAIL_NOT_VERIFIED);
//     }
//     const passwordMatch = await comparePassword(password, user.password);
//     if (!passwordMatch) {
//       throw new UnauthorizedException(
//         "Password does not match",
//         ErrorCode.INVALID_CREDENTIALS
//       );
//     }
//     const { accessToken, refreshToken } = await generateAccessandRefreshToken(
//       user.id
//     );
//     const loggedInUser = await prisma.user.findUnique({
//       where: { id: user.id },
//       select: {
//         id: true,
//         fullName: true,
//         email: true,
//         isVerified: true,
//         createdAt: true,
//         updatedAt: true,
//         role: true,
//       },
//     });
//     const cookieOptions: CookieOptions = {
//       httpOnly: true,
//       secure: true,
//       sameSite: "none",
//     };
//     res
//       .status(200)
//       .cookie("accessToken", accessToken, cookieOptions)
//       .cookie("refreshToken", refreshToken, cookieOptions)
//       .cookie("role", user.role.trim(), cookieOptions) // Set role in a cookie
//       .json(
//         new ApiResponse("User logged in successfully", {
//           user: loggedInUser,
//           accessToken,
//           refreshToken,
//         })
//       );
//   } catch (error) {
//     next(error);
//   }
// };

// export const logout = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const user = (req as any).user;

//     if (user) {
//       await prisma.user.update({
//         where: { id: user.id },
//         data: { refreshToken: null },
//       });
//     } else {
//       throw new UnauthorizedException(
//         "User not found",
//         ErrorCode.UNAUTHORIZED_REQUEST
//       );
//     }

//     const cookieOptions: CookieOptions = {
//       httpOnly: true,
//       secure: true,
//       sameSite: "none",
//     };

//     res
//       .status(200)
//       .clearCookie("accessToken", cookieOptions)
//       .clearCookie("refreshToken", cookieOptions)
//       .clearCookie("role", cookieOptions)
//       .json(new ApiResponse("User logged out successfully", user));
//   } catch (error) {
//     next(error);
//   }
// };

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      throw new BadRequestException("Email and OTP are required", ErrorCode.NOT_FOUND);
    }

    // Find the most recent valid OTP
    const otpRecord = await prisma.otp.findFirst({
      where: {
        email,
        verified: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
      throw new BadRequestException(
        "Invalid or expired OTP", 
        ErrorCode.INVALID_OTP
      );
    }

    // Check max attempts
    if (otpRecord.attempts >= 5) {
      await prisma.otp.update({
        where: { id: otpRecord.id },
        data: { verified: true }, // Lock it
      });
      throw new BadRequestException(
        "Too many failed attempts. Please request a new OTP.", 
        ErrorCode.RATE_LIMIT_EXCEEDED
      );
    }

    // Verify OTP
    const isOtpValid = await comparePassword(otp, otpRecord.otp);
    
    if (!isOtpValid) {
      // Increment attempts
      await prisma.otp.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      
      throw new BadRequestException(
        `Invalid OTP. ${5 - otpRecord.attempts - 1} attempts remaining.`, 
        ErrorCode.INVALID_OTP
      );
    }

    // Use transaction for atomic operations
    await prisma.$transaction(async (tx) => {
      // Mark OTP as verified
      await tx.otp.update({
        where: { id: otpRecord.id },
        data: { verified: true },
      });

      // Update user as verified
      await tx.user.update({
        where: { id: otpRecord.userId },
        data: { 
          emailVerified: true
        },
      });

      // Delete old OTPs
      await tx.otp.deleteMany({
        where: {
          userId: otpRecord.userId,
          verified: false,
          id: { not: otpRecord.id },
        },
      });
    });

    res.status(200).json(
      new ApiResponse("Email verified successfully", { verified: true })
    );
  } catch (error) {
    next(error);
  }
};

// Resend OTP
export const resendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new BadRequestException("Email is required", ErrorCode.NOT_FOUND);
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
      }
    });

    if (!user) {
      throw new BadRequestException("User not found", ErrorCode.USER_NOT_FOUND);
    }

    if (user.emailVerified) {
      return res.status(400).json(
        new ApiResponse("Email already verified", { isVerified: true })
      );
    }

    // Rate limiting check
    const recentOtp = await prisma.otp.findFirst({
      where: {
        userId: user.id,
        createdAt: {
          gt: new Date(Date.now() - 60 * 1000), // Last 1 minute
        },
      },
    });

    if (recentOtp) {
      throw new BadRequestException(
        "Please wait 1 minute before requesting another OTP", 
        ErrorCode.RATE_LIMIT_EXCEEDED
      );
    }

    // Reuse the utility function
    try {
      await createAndSendOtp(user.id, user.email, user.name);
    } catch (emailError) {
      console.error("Failed to send OTP:", emailError);
      throw new InternalException(
        "Failed to send verification email", 
        ErrorCode.EMAIL_SEND_FAILED
      );
    }

    res.status(200).json(
      new ApiResponse("OTP sent successfully", {
        email: user.email,
        expiresIn: "10 minutes",
      })
    );
  } catch (error) {
    next(error);
  }
};
// export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { email } = ForgotPasswordSchema.parse(req.body);
//     const user = await prisma.user.findUnique({
//       where: { email },
//     });

//     if (!user) {
//       throw new BadRequestException("User with this email not found", ErrorCode.USER_NOT_FOUND);
//     }

//     const otp = generateOtp();
//     const otpHash = await hashPassword(otp);
//     const otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000);

//     await prisma.user.update({
//       where: { id: user.id },
//       data: {
//         otp: otpHash,
//         purpose: OtpPurpose.FORGOT_PASSWORD,
//         otpExpiresAt: otpExpiresAt,
//       },
//     });

//     await sendEmail(email, otp, OtpPurpose.FORGOT_PASSWORD);

//     res.status(200).json(new ApiResponse("Password reset OTP sent to email", { userId: user.id, email: user.email }));
//   } catch (error) {
//     next(error);
//   }
// };

