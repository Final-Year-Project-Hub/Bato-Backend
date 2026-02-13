import { Response,Request,NextFunction} from "express";
import { hashPassword } from "../utils/hash";
import { prisma } from "../lib/prisma";
import { ApiResponse } from "@/utils/apiResponse";
import { BadRequestException, ErrorCode } from "@/utils/root";
import { uploadToCloudinary } from "../utils/uploadCloudinary";

import { createAndSendOtp } from "../utils/otp";

export const editUser = async(req:Request,res:Response,next:NextFunction)=>{
    const userId = req.user?.id;
    if(!userId){
        throw new BadRequestException("User ID is required",ErrorCode.BAD_REQUEST)
    }
    
    try{
        const {name, email, password} = req.body;
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        
        if (!currentUser) {
            throw new BadRequestException("User not found", ErrorCode.USER_NOT_FOUND);
        }


        const updates: any = {};
        let message = "User profile updated successfully";
        let emailChangePending = false;

        // Handle email change separately
        if (email && email !== currentUser.email) {
            emailChangePending = true;
            
            // Check if new email is already taken
            const emailExists = await prisma.user.findUnique({ where: { email } });
            if (emailExists) {
                throw new BadRequestException("Email already in use", ErrorCode.USER_ALREADY_EXISTS);
            }

            // Send OTP to new email
            await createAndSendOtp(currentUser.id, email, name || currentUser.name);
            message = "Profile updated. Please verify your new email address via OTP sent to " + email;
        }

        if (name) updates.name = name;
        if (password) updates.password = await hashPassword(password);

        // Update other fields immediately
        if (Object.keys(updates).length > 0) {
           await prisma.user.update({
                where:{ id: userId },
                data: updates,
            });
        }

        // Fetch updated user
        const updatedUser = await prisma.user.findUnique({
             where: { id: userId },
             select:{
                id:true,
                name:true,
                email:true,
                image: true,
                createdAt:true,
                updatedAt:true,
                role:true,
            },
        });

        res.status(200).json(new ApiResponse(message, {
            user: updatedUser,
            emailChangePending
        }));

    } catch(error){
        next(error)
    }
}

export const userProfileImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const image = req.file;
    if (!image) {
      return res.status(400).json({ message: "Image is required" });
    }

    const uploadResult = await uploadToCloudinary(image.buffer, "users");

    const updatedUser = await prisma.user.update({
      where: { id: req.user?.id }, // assuming auth middleware
      data: {
        image: uploadResult.secure_url,
      },
    });

    res.status(200).json({
        updatedUser,
      message: "Profile image updated",
      image: uploadResult.secure_url,
    });
  } catch (error) {
    next(error);
  }
};


export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new BadRequestException("User ID is required", ErrorCode.BAD_REQUEST);
    }

    try {
        await prisma.user.delete({
            where: { id: userId }
        });
        
        res.status(200).json(new ApiResponse("User account deleted successfully", null));

    } catch (error) {
        next(error);
    }
}

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id as string;
    if (!userId) {
        throw new BadRequestException("User ID is required", ErrorCode.BAD_REQUEST);
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            throw new BadRequestException("User not found", ErrorCode.USER_NOT_FOUND);
        }

        res.status(200).json(new ApiResponse("User fetched successfully", user));

    } catch (error) {
        next(error);
    }
} 

export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                emailVerified: true,
                image: true,
                roadmaps: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        res.status(200).json(new ApiResponse("Users fetched successfully", users));

    } catch (error) {
        next(error);
    }
} 

export const getRecentActivity = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new BadRequestException("User ID is required", ErrorCode.BAD_REQUEST);
    }

    try {
        const activities = await prisma.userActivity.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        const formattedActivities = activities.map(activity => {
            const meta = activity.metadata as any;
            return {
                id: activity.id,
                type: activity.type,
                entityId: activity.entityId,
                timestamp: activity.createdAt,
                title: meta?.title || meta?.topicTitle || "Unknown Activity",
                metadata: {
                    ...meta,
                    topicId: meta?.topicId || meta?.topicContentId, // Handle both potential keys
                    roadmapId: meta?.roadmapId,
                    phaseId: meta?.phaseId
                }
            };
        });

        res.status(200).json(new ApiResponse("Recent activity fetched successfully", formattedActivities));

    } catch (error) {
        next(error);
    }
}

