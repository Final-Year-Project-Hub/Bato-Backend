import { HttpException } from "../exceptions/root";
import { Request, Response, NextFunction } from "express";

export const errorMiddleware = (
  error: HttpException,
  req: Request,
  res: Response,
  next: NextFunction
) => {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    const errorCode = error.errorCode 
    const errors = error.errors 
    res.status(statusCode).json({
        message,
        errorCode,  
        errors
    });
}