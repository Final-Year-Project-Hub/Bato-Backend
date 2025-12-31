import { BadRequestException, InternalException, HttpException, ErrorCode } from "../utils/root";
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
      } 
      else if (error instanceof ZodError) {
        const fieldErrors = error.issues.map(issue => ({
          field: issue.path.join("."),
          message: issue.message,
        }));

        exception = new BadRequestException(
          "Unprocessable Entity",              // ✅ generic message
          ErrorCode.UNPROCESSABLE_ENTITY,
          fieldErrors                           // ✅ clean details
        );
      } 
      else {
        exception = new InternalException(
          "An unexpected error occurred",
          ErrorCode.INTERNAL_EXCEPTION,
          error.message
        );
      }
      next(exception);
    }
  };
};
