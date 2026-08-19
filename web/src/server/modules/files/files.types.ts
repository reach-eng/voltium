export type FileCategory =
  | 'kyc_document'
  | 'profile_photo'
  | 'vehicle_photo'
  | 'payment_proof'
  | 'support_attachment'
  | 'pickup_verification'
  | 'RETURN_PHOTO'
  | 'TOPUP_PROOF'
  | 'vehicle_return'
  // PR-ONBOARDING-FLOW-2026-08-12: security-deposit proof uploaded from
  // the rider app's new deposit workflow (between choosePlan and
  // pickupHub). Stored as a separate category from `payment_proof` so
  // the admin panel can filter "deposit proof" submissions distinctly
  // from top-up / wallet-load proofs. Mime + size rules mirror
  // `payment_proof` (jpeg / png / pdf up to 5MB).
  | 'security_deposit';

export enum FileOwnerType {
  RIDER = 'RIDER',
  ADMIN = 'ADMIN',
  SYSTEM = 'SYSTEM',
}

export interface SignedUrlRequest {
  fileName: string;
  mimeType: string;
  category: FileCategory;
  fileSize: number;
}

export interface SignedUrlResponse {
  uploadUrl: string;
  fileRecordId: string;
  storageKey: string;
  uploadToken: string;
  expiresIn: number;
}

export interface ConfirmUploadRequest {
  fileRecordId: string;
  sizeBytes: number;
  checksum?: string;
  idempotencyKey?: string;
}

export interface RequestReadUrlRequest {
  fileRecordId: string;
}

export interface RequestReadUrlResponse {
  readUrl: string;
  expiresIn: number;
}

export const FILE_UPLOAD_RULES: Record<
  FileCategory,
  { allowedMimeTypes: string[]; maxSizeBytes: number }
> = {
  kyc_document: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4', 'video/quicktime'],
    maxSizeBytes: 25 * 1024 * 1024,
  },
  profile_photo: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSizeBytes: 2 * 1024 * 1024,
  },
  vehicle_photo: {
    allowedMimeTypes: ['image/jpeg', 'image/png'],
    maxSizeBytes: 5 * 1024 * 1024,
  },
  payment_proof: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeBytes: 5 * 1024 * 1024,
  },
  support_attachment: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4'],
    maxSizeBytes: 10 * 1024 * 1024,
  },
  pickup_verification: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSizeBytes: 10 * 1024 * 1024,
  },
  RETURN_PHOTO: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSizeBytes: 10 * 1024 * 1024,
  },
  TOPUP_PROOF: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeBytes: 10 * 1024 * 1024,
  },
  vehicle_return: {
    allowedMimeTypes: ['image/jpeg', 'image/png'],
    maxSizeBytes: 10 * 1024 * 1024,
  },
  // PR-ONBOARDING-FLOW-2026-08-12: mirrors payment_proof — a security
  // deposit proof is functionally a payment proof, but the dedicated
  // category lets the admin panel separate "deposit review" from
  // "wallet top-up review".
  security_deposit: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeBytes: 5 * 1024 * 1024,
  },
};

export const FILE_PURPOSE_MAP: Record<FileCategory, string> = {
  kyc_document: 'kyc_document',
  profile_photo: 'profile_photo',
  vehicle_photo: 'vehicle_photo',
  payment_proof: 'payment_proof',
  support_attachment: 'support_attachment',
  pickup_verification: 'pickup_verification',
  RETURN_PHOTO: 'RETURN_PHOTO',
  TOPUP_PROOF: 'TOPUP_PROOF',
  vehicle_return: 'vehicle_return',
  security_deposit: 'security_deposit',
};
