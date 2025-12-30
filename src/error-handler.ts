import { BadRequestException } from "./exceptions/bad-request";
import { InternalException } from "./exceptions/internal-exception";
import { HttpException, ErrorCode } from "./exceptions/root";
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export const errorHandler = (method: Function) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await method(req, res, next);
    } catch (error: any) {
      let exception: HttpException;
      if (error instanceof HttpException) {
        exception = error;
      } else {
        if (error instanceof ZodError) {
          exception = new BadRequestException(
            "Unprocessable Entity",
            ErrorCode.UNPROCESSABLE_ENTITY,
            error
          );
        } else {
          exception = new InternalException(
            "An unexpected error occurred",
            ErrorCode.INTERNAL_EXCEPTION,
            error.message
          );
        }
      }
      next(exception);
    }
  };
};
