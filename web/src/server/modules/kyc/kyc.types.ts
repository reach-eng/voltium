/**
 * KYC module - Types
 *
 * Know Your Customer document verification types.
 */

export type KycStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'INFO_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

export enum EditableField {
  aadhaarFront = 'aadhaarFront',
  aadhaarBack = 'aadhaarBack',
  pan = 'panCard',
  selfie = 'profilePhoto',
  signature = 'signature',
  name = 'fullName',
  email = 'email',
  dob = 'dob',
  address = 'currentAddress',
  fatherName = 'fatherName',
  motherName = 'motherName',
  bankName = 'bankName',
  bankAccount = 'accountNumber',
  bankIfsc = 'ifscCode'
}

export interface KycSubmission {
  riderId: string;
  aadhaarNumber: string;
  panNumber: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  aadhaarFront?: string;
  aadhaarBack?: string;
  panCard?: string;
  profilePhoto?: string;
  signature?: string;
}

export interface KycReview {
  reviewerId: string;
  action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
  rejectionReason?: string;
  infoRequest?: string;
  editableFields?: string[];
}

export interface KycRecord {
  id: string;
  riderId: string;
  status: KycStatus;
  aadhaarNumber: string;
  panNumber: string;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  editableFields?: string[];
}
