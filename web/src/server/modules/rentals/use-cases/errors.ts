import { DomainError } from '@/lib/domain-error';

export class RentalBookError extends DomainError {
  readonly errorCode: string;
  readonly httpStatus: number;

  constructor(message: string, code = 'RENTAL_ERROR') {
    super(message);
    this.name = 'RentalBookError';
    this.errorCode = code;
    if (code === 'NOT_FOUND') this.httpStatus = 404;
    else if (code === 'CONFLICT') this.httpStatus = 409;
    else if (code === 'VALIDATION') this.httpStatus = 400;
    else this.httpStatus = 400;
  }
}
