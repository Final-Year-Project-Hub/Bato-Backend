/**
 * Base HTTP Exception class for all custom errors
 */
export class HttpException extends Error {
  message: string;
  errorCode: ErrorCode;
  statusCode: number;
  errors: any;

  constructor(
    message: string,
    errorCode: ErrorCode,
    statusCode: number,
    error: any
  ) {
    super(message);
    this.message = message;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.errors = error;
  }
}

/**
 * Error codes for different types of errors
 */
export enum ErrorCode {
  USER_NOT_FOUND = 1001,
  USER_ALREADY_EXISTS = 1002,
  INVALID_CREDENTIALS = 1003,
  UNPROCESSABLE_ENTITY = 2001, // Client-side data validation error
  UNAUTHORIZED_REQUEST = 2002,
  INTERNAL_EXCEPTION = 3001,
  NOT_FOUND = 4004,
  EMAIL_SEND_FAILED = 4005,
  EMAIL_NOT_VERIFIED = 4006,
  INVALID_OTP = 4007,
  RATE_LIMIT_EXCEEDED = 4008,
}

/**
 * Bad Request Exception (400)
 */
export class BadRequestException extends HttpException {
  constructor(message: string, errorCode: ErrorCode, errors: any = null) {
    errors = errors || null;
    super(message, errorCode, 400, errors);
  }
}

/**
 * Internal Server Error Exception (500)
 */
export class InternalException extends HttpException {
  constructor(message: string, errorCode: ErrorCode, errors: any = null) {
    super(message, errorCode, 500, errors);
  }
}

/**
 * Unprocessable Entity Exception (422)
 */
export class UnprocessableEntityException extends HttpException {
  constructor(message: string, errorCode: ErrorCode, errors: any = null) {
    super(message, errorCode, 422, errors);
  }
}

/**
 * Unauthorized Exception (401)
 */
export class UnauthorizedException extends HttpException {
  constructor(message: string, errorCode: ErrorCode, errors: any = null) {
    super(message, errorCode, 401, errors);
  }
}

/**
 * Not Found Exception (404)
 */
export class NotFoundException extends HttpException {
  constructor(message: string, errorCode: ErrorCode, errors: any = null) {
    super(message, errorCode, 404, errors);
  }
}
