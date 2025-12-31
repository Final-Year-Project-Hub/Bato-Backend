import { comparePassword, hashPassword } from "../utils/hash";
import { prisma } from "../../lib/prisma.js";
import { Request, Response, NextFunction } from "express";
import { LoginSchema, SignUpSchema } from "../validation/auth.validations";
import { BadRequestException, ErrorCode } from "../utils/root";
import { ApiResponse } from "../utils/apiResponse";

export const signUp = async(req: Request, res: Response, next: NextFunction) => {
        const { email, password, fullName } = SignUpSchema.parse(req.body);
        
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });
     
        if (existingUser) {
            throw new BadRequestException('User already exists', ErrorCode.USER_ALREADY_EXISTS);
        }
   
        const hashedPassword = await hashPassword(password);
   
        const newUser = await prisma.user.create({
            data: {
                fullName,
                email,
                password: hashedPassword,
            },
            select:{
                id:true,
                fullName:true,
                email:true,
                createdAt:true,
                updatedAt:true
            }
        });
        res.status(201).json(new ApiResponse("User Registered Successfully",newUser))
}

export const login = async(req:Request,res:Response,next:NextFunction) =>{
    const{email,password} = LoginSchema.parse(req.body);
    try{
    const user = await prisma.user.findUnique({
        where:{email}
    })
    if(!user){
        throw new BadRequestException('User not found',ErrorCode.USER_NOT_FOUND)
    }
    const passwordMatch= await comparePassword(password,user.password)
    if(!passwordMatch){
        throw new BadRequestException('Password does not match',ErrorCode.INVALID_CREDENTIALS)
    }
    const loggedInUser = await prisma.user.findUnique({
        where:{id:user.id}
    })
    res.status(200).json(new ApiResponse("User Logged In Successfully",loggedInUser))
}
catch(error){
    next(error)
}
}
