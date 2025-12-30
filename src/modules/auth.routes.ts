import { Router, Request, Response, NextFunction } from "express";
import { signUp } from "./auth.service.js";
import { UnprocessableEntity } from "../exceptions/validation.js";
import { ErrorCode } from "../exceptions/root.js";
import { BadRequestException } from "../exceptions/bad-request.js";
import { SignUpSchema } from "../schema/user.js";

const router = Router();

router.post("/signup", async (req: Request, res: Response,next: NextFunction): Promise<void> => {
        SignUpSchema.parse(req.body);
        const { fullName, email, password } = req.body;
        const user = await signUp(fullName, email, password);
        
        if (!user) {
           throw new BadRequestException('User the email already exists', ErrorCode.USER_ALREADY_EXISTS);
        }

        res.status(201).json(user);
});

export default router;