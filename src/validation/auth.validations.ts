import {z} from "zod";

export const SignUpSchema = z.object({
    fullName: z.string().min(2).max(100,"Full name is required"),
    email: z.string().email({ message: "Invalid email address" }),
    password: z.string().min(6,"Password must be at least 6 chars").max(100),
    confirmPassword: z.string().min(6).max(100), 
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
 });

export const LoginSchema = z.object({
    email: z.string().email({ message: "Invalid email address" }),
    password: z.string().min(6,"Password must be at least 6 chars").max(100),

})
export type User = z.infer<typeof SignUpSchema>;

