
import { HttpException, ErrorCode } from "./root";

export class InternalException extends HttpException {
    constructor(message: string, errorCode: ErrorCode, errors: any = null) {
        super(message, errorCode, 500, errors);
    }
}