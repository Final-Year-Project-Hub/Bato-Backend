import {z} from "zod";

export const SignUpSchema = z.object({
    fullName: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(6).max(100),
    
});
export type User = z.infer<typeof SignUpSchema>;