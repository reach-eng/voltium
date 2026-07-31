export class DepositStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DepositStateError';
  }
}
