/**
 * Guarantors module - Types
 *
 * Guarantor submission, verification, and replacement types.
 * A guarantor vouches for a rider during onboarding — statuses must transition
 * linearly and a REPLACED record is terminal (rider must submit a new guarantor).
 */

export type GuarantorStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'INFO_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'REPLACED';

export interface GuarantorSubmission {
  riderId: string;
  name: string;
  relation: string;
  phone: string;
  dob?: string;
  fatherName?: string;
  motherName?: string;
  aadhaarFront?: string;
  aadhaarBack?: string;
  pan?: string;
  video?: string;
  signature?: string;
  photo?: string;
}

export interface GuarantorReview {
  reviewerId: string;
  action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
  rejectionReason?: string;
  infoRequest?: string;
}

export interface GuarantorRecord {
  id: string;
  riderId: string;
  status: GuarantorStatus;
  name: string;
  relation: string;
  phone: string;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  replacedAt?: Date;
}
