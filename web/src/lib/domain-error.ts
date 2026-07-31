import { ErrorCode, ERROR_CODES } from './api-error';

export abstract class DomainError extends Error {
  abstract readonly httpStatus: number;
  abstract readonly errorCode: ErrorCode | string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
