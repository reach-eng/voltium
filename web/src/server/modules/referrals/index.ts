import { processReferralReward } from './use-cases/process-referral-reward';
import { getReferrals } from './use-cases/get-referrals';
import { getReferralInfo } from './use-cases/get-referral-info';
import { listAdminReferrals } from './use-cases/list-admin-referrals';

export const referralUseCases = {
  processReferralReward,
  getReferrals,
  getReferralInfo,
  listAdminReferrals,
};
