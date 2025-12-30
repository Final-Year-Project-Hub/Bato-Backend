import { Router, Request, Response } from "express";
import { signUp } from "./auth.service.js";

const router = Router();

router.post("/signup", async (req: Request, res: Response): Promise<void> => {
    try {
        const { fullName, email, password } = req.body;
        const user = await signUp(fullName, email, password);

        if (!user) {
            res.status(400).json({ error: "User already exists" });
            return;
        }

        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
