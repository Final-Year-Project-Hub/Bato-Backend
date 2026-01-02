import { BadRequestException, InternalException, HttpException, UnauthorizedException, UnprocessableEntityException, ErrorCode } from "../utils/root";
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

        exception = new UnprocessableEntityException(
          "Validation Error",
          ErrorCode.UNPROCESSABLE_ENTITY,
          fieldErrors
        );
      } 
      else if (error instanceof Error) {
        exception = new InternalException(
          "An unexpected error occurred",
          ErrorCode.INTERNAL_EXCEPTION,
          error.message
        );
      }
      else {
        exception = new InternalException(
          "Unknown Error",
          ErrorCode.INTERNAL_EXCEPTION,
          error
        );
      }
      
      console.error("[ErrorHandler]", {
        message: exception.message,
        errorCode: exception.errorCode,
        errors: exception.errors,
        stack: error instanceof Error ? error.stack : undefined
      });

      next(exception);
    }
  };
};
