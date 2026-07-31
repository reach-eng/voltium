/**
 * Rental use-case error classes.
 */

export class RentalBookError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'RentalBookError';
  }
}

export class RentalReturnError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'RentalReturnError';
  }
}

export class RentalNotFoundError extends Error {
  constructor(message = 'Rental not found') {
    super(message);
    this.name = 'RentalNotFoundError';
  }
}
