import { comparePassword, hashPassword } from "../utils/hash";
import { createAndSendOtp, generateOtp } from "../utils/otp";
import { prisma } from "../lib/prisma";
import { Request, Response, NextFunction} from "express";
import jwt from "jsonwebtoken";
import { cookieOptions } from "../utils/jwt";
import {
  BadRequestException,
  ErrorCode,
  InternalException,
  UnauthorizedException,
} from "../utils/root";
import { ApiResponse } from "../utils/apiResponse";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { OtpPurpose } from "@prisma/client";
import {
  VerifyOtpSchema,
  ResendOtpSchema,
} from "../validation/auth.validations";
import { paginate } from "@/utils/pagination";
import { cleanRegex } from "zod/v4/core/util.cjs";

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
// export const generateOtp = (): string =>
//   Math.floor(100000 + Math.random() * 900000).toString();

export const signUp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (existingUser.emailVerified) {
        // Verified user trying to sign up again -> Error
        throw new BadRequestException(
          "User already exists",
          ErrorCode.USER_ALREADY_EXISTS,
        );
      } else {
        // Unverified user returning -> Let them finish registration
        // 1. Update password & name (in case they changed them)
        const hashedPassword = await hashPassword(password);
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { password: hashedPassword, name },
        });

        // 2. Resend the OTP
        try {
          // Note: createAndSendOtp usually creates a NEW db record for OTP
          await createAndSendOtp(existingUser.id, email, name);

          res.status(200).json(
            new ApiResponse(
              "Account exists but was unverified. A new OTP has been sent to your email.",
              {
                id: existingUser.id,
                email,
                name,
                isRetry: true,
              },
            ),
          );
          return;
        } catch (error) {
          throw new InternalException(
            "Failed to send OTP email",
            ErrorCode.INTERNAL_EXCEPTION,
          );
        }
      }
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Send OTP for email verification
    try {
      await createAndSendOtp(newUser.id, newUser.email, newUser.name);
    } catch (error) {
      // Rollback user creation if OTP sending fails
      await prisma.user.delete({
        where: { id: newUser.id },
      });
      throw new InternalException(
        "Failed to send OTP email",
        ErrorCode.INTERNAL_EXCEPTION,
      );
    }

    res
      .status(201)
      .json(
        new ApiResponse(
          "User registered successfully. Please verify your email.",
          newUser,
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException("User not found", ErrorCode.USER_NOT_FOUND);
    }

    if (!user.emailVerified) {
      throw new BadRequestException(
        "Please verify your email first",
        ErrorCode.EMAIL_NOT_VERIFIED,
      );
    }

    const passwordMatch = await comparePassword(password, user.password!);
    if (!passwordMatch) {
      throw new BadRequestException(
        "Invalid credentials",
        ErrorCode.INVALID_CREDENTIALS,
      );
    }

    const { accessToken, refreshToken } = await generateAccessandRefreshToken(
      user.id,
    );

    const loggedInUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        role: true,
      },
    });

    res
      .status(200)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .json(
        new ApiResponse("User logged in successfully", {
          user: loggedInUser,
          accessToken,
          refreshToken,
        }),
      );
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
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
        ErrorCode.UNAUTHORIZED_REQUEST,
      );
    }
    res
      .status(200)
      .clearCookie("accessToken", cookieOptions)
      .clearCookie("refreshToken", cookieOptions)
      .json(new ApiResponse("User logged out successfully", user));
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      throw new BadRequestException(
        "Email and OTP are required",
        ErrorCode.NOT_FOUND,
      );
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
        createdAt: "desc",
      },
    });

    if (!otpRecord) {
      throw new BadRequestException(
        "Invalid or expired OTP",
        ErrorCode.INVALID_OTP,
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
        ErrorCode.RATE_LIMIT_EXCEEDED,
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
        ErrorCode.INVALID_OTP,
      );
    }

    // Use transaction for atomic operations
    const updatedUser = await prisma.$transaction(
      async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
        // Mark OTP as verified
        await tx.otp.update({
          where: { id: otpRecord.id },
          data: { verified: true },
        });

        // Update user as verified and update email if changed
        const user = await tx.user.update({
          where: { id: otpRecord.userId },
          data: {
            emailVerified: true,
            email: otpRecord.email, // Update email to the one that was verified
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

        return user;
      },
    );
if(otpRecord.purpose === "EMAIL_VERIFICATION"){
    res.status(200).json(
      new ApiResponse("Email verified successfully. Please sign in.", {
        updatedUser,
        emailVerified: true,
      }),
    );
}
if(otpRecord.purpose === "FORGOT_PASSWORD"){
  const secret = process.env.REFRESH_TOKEN_SECRET!;
  const resetToken = jwt.sign(
    { userId: otpRecord.userId }, // Payload
    secret,
    { expiresIn: "10m" }
  );
  
  // const hashedResetToken = await hashPassword(resetToken);
  
  await prisma.user.update({
    where: { id: otpRecord.userId },
    data: { refreshToken: resetToken },
  });

  res.status(200).json(
    new ApiResponse("Email verified successfully. Please reset your password.", {
      updatedUser,
      emailVerified: true,
    }),
  );
}
  } catch (error) {
    next(error);
  }
};

// Resend OTP
export const resendOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
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
      },
    });

    if (!user) {
      throw new BadRequestException("User not found", ErrorCode.USER_NOT_FOUND);
    }

    if (user.emailVerified) {
      return res
        .status(400)
        .json(new ApiResponse("Email already verified", { isVerified: true }));
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
        ErrorCode.RATE_LIMIT_EXCEEDED,
      );
    }

    // Reuse the utility function
    try {
      await createAndSendOtp(user.id, user.email, user.name);
    } catch (emailError) {
      console.error("Failed to send OTP:", emailError);
      throw new InternalException(
        "Failed to send verification email",
        ErrorCode.EMAIL_SEND_FAILED,
      );
    }

    res.status(200).json(
      new ApiResponse("OTP sent successfully", {
        email: user.email,
        expiresIn: "10 minutes",
      }),
    );
  } catch (error) {
    next(error);
  }
};
  export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {email}= req.body || {};

      if (!email) {
        throw new BadRequestException("Email is required", ErrorCode.BAD_REQUEST);
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select:{
          id:true,
          email:true,
          otps:true,
          name:true,
          emailVerified:true,
        }
      });

      if (!user) {
        throw new BadRequestException("User with this email not found", ErrorCode.USER_NOT_FOUND);
      }
      await createAndSendOtp(user.id, user.email, user.name, OtpPurpose.FORGOT_PASSWORD);
      res.status(200).json(
        new ApiResponse("OTP sent successfully", {
         user,
        }),
      );
    } catch (error) {
      next(error);
      // throw new InternalException("Failed to send OTP", ErrorCode.INTERNAL_SERVER_ERROR);
    }
  };

  export const resetPassword = async (req:Request,res:Response,next:NextFunction)=>{
    try {
      const { token, password } = req.body || {};
      
      if (!token) {
        throw new BadRequestException("Reset token is required", ErrorCode.BAD_REQUEST);
      }
      
      if (!password) {
         throw new BadRequestException("Password is required", ErrorCode.BAD_REQUEST);
      }

      // Verify token signature
      let decoded: any;
      try {
        decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!);
      } catch (error) {
        throw new BadRequestException("Invalid or expired reset token", ErrorCode.UNAUTHORIZED_REQUEST);
      }
      
      const userId = decoded.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user || !user.refreshToken) {
         throw new BadRequestException("Invalid request", ErrorCode.UNAUTHORIZED_REQUEST);
      }
      
      // Verify token matches the one in DB
      const isTokenValid = await comparePassword(token, user.refreshToken);
      if (!isTokenValid) {
        throw new BadRequestException("Invalid reset token", ErrorCode.UNAUTHORIZED_REQUEST);
      }

      const newPassword = await hashPassword(password);
      
      const updatedUser = await prisma.user.update({
        where:{
         id: userId,
        },
        data:{
          password:newPassword,
          refreshToken: null // Delete token after use
        }
      })
      res.status(200).json(new ApiResponse("Password reset successfully", updatedUser));
    } catch (error) {
      next(error);
    }
  }

export const overViewSummary = async (req: Request, res: Response, next: NextFunction) => {
  const totalUsers = await prisma.user.count();
  const activeUsers = await prisma.user.count({
    where:{
      isActive:true
    }
  })
  const totalRoadmaps = await prisma.roadmap.count();
  const totalDocuments = await prisma.document.count();
  
  res.status(200).json(new ApiResponse("Overview summary", {
    totalUsers,
    activeUsers,
    totalRoadmaps,
    totalDocuments,
  }));
};

export const users = async (req: Request, res: Response, next: NextFunction) => {
  const { page, limit, skip, search, sortBy, sortOrder } = paginate(req.query);

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy || "createdAt"]: sortOrder || "desc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.status(200).json(
    new ApiResponse("Users", {
      users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  );
};