// Re-export all validators from domain files.
// This file maintains backward compatibility — all existing imports
// like `import { riderSchema } from '@/lib/validators'` continue to work.

export { phoneSchema, validateBody } from './common';
export { sendOtpSchema, verifyOtpSchema, refreshTokenSchema } from './auth';
export {
  updateProfileSchema,
  createRiderSchema,
  riderActionSchema,
  registerTokenSchema,
  devicePermissionsSchema,
  bulkActionSchema,
} from './rider';
export { submitKycSchema, submitGuarantorSchema } from './kyc';
export { topUpSchema, approveTransactionSchema, transactionBulkActionSchema } from './transaction';
export {
  createTicketSchema,
  updateTicketSchema,
  ticketReplySchema,
  ticketBulkActionSchema,
  chatMessageSchema,
} from './ticket';
export {
  DURATION_DAYS_BY_TYPE,
  createPlanSchema,
  updatePlanSchema,
  deletePlanSchema,
  subscribePlanSchema,
} from './plan';
export {
  createVehicleSchema,
  updateVehicleSchema,
  vehicleReturnSchema,
  vehicleBulkActionSchema,
} from './vehicle';
export {
  sendNotificationSchema,
  createOfferSchema,
  createCouponSchema,
  updateCouponSchema,
  feedbackSchema,
  createFaqSchema,
  createHubSchema,
  hubBulkActionSchema,
  createTeamLeaderSchema,
  teamLeaderBulkActionSchema,
  updateLegalSchema,
  updateSettingsSchema,
  syncQueueSchema,
  awardRewardSchema,
  adminWalletTopupSchema,
  createAnnouncementSchema,
  createIncidentSchema,
  updateIncidentSchema,
  createEarningSchema,
  recalculateScoreSchema,
} from './admin';
