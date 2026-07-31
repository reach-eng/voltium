import { getWallet } from './wallet.use-cases.query';
import { requestTopup, _autoApproveTestTopup, approveTopup, rejectTopup } from './wallet.use-cases.topup';
import { reverseTransaction } from './wallet.use-cases.reversal';

export const walletUseCases = {
  getWallet,
  requestTopup,
  _autoApproveTestTopup,
  approveTopup,
  rejectTopup,
  reverseTransaction,
};
