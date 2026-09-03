export interface FeatureFlags {
  enableReferralSystem: boolean;
  enableRewardsSystem: boolean;
  enableVehicleAssignment: boolean;
  enableKYCVerification: boolean;
  enableGuarantorRequirement: boolean;
  enableDynamicPricing: boolean;
  enableOfflineMode: boolean;
  enableChatSupport: boolean;
  enablePushNotifications: boolean;
  maxUploadSizeMb: number;
}

export const FLAG_LABELS: Record<string, string> = {
  enableReferralSystem: 'Referral System',
  enableRewardsSystem: 'Rewards & Loyalty System',
  enableVehicleAssignment: 'Vehicle Assignment Flow',
  enableKYCVerification: 'Mandatory KYC Verification',
  enableGuarantorRequirement: 'Guarantor Requirement for Rentals',
  enableDynamicPricing: 'Dynamic Pricing Engine',
  enableOfflineMode: 'Offline Mode Support',
  enableChatSupport: 'In-App Support Chat',
  enablePushNotifications: 'Push Notifications Channel',
  maxUploadSizeMb: 'Maximum File Upload Size (MB)',
};

export const FLAG_DESCRIPTIONS: Record<string, string> = {
  enableReferralSystem: 'Allow riders to invite friends and earn referral rewards.',
  enableRewardsSystem: 'Enable points earning and reward redemption catalog.',
  enableVehicleAssignment: 'Require explicit vehicle-to-rider matching before rental starts.',
  enableKYCVerification: 'Block rental bookings until Aadhaar & DL are verified.',
  enableGuarantorRequirement: 'Require a verified guarantor for high-value vehicle rentals.',
  enableDynamicPricing: 'Apply peak-demand and location-based rate adjustments.',
  enableOfflineMode: 'Allow mobile app to cache data and operate with limited connectivity.',
  enableChatSupport: 'Enable live support ticket chat in the mobile app.',
  enablePushNotifications: 'Send transactional push notifications via Firebase Cloud Messaging.',
  maxUploadSizeMb: 'Global limit for image and document uploads across all endpoints.',
};
