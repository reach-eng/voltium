/**
 * KYC use-case error classes.
 */

export class KycApproveError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'KycApproveError';
  }
}
