export class WalletServiceError extends Error {
  code: string;
  constructor(message: string, code: string = 'WALLET_ERROR') {
    super(message);
    this.name = 'WalletServiceError';
    this.code = code;
  }
}
