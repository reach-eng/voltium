/**
 * Wallet error classes.
 */

export class WalletServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'WalletServiceError';
  }
}

export class InsufficientFundsError extends WalletServiceError {
  constructor(message = 'Insufficient funds') {
    super(message, 'INSUFFICIENT_FUNDS');
    this.name = 'InsufficientFundsError';
  }
}
