/**
 * Pickup use-case error classes.
 */

export class PickupVerificationError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'PickupVerificationError';
  }
}
