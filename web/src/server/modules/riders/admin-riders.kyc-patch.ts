/**
 * Admin Riders — KYC & Guarantor Patch Processing
 *
 * Sanitization, PII encryption, and allowlist-driven data extraction for rider updates.
 */

import { sanitizeText } from '@/lib/sanitize';
import { encryptPii } from '@/lib/pii-crypto';

export const KYC_FIELDS = new Set([
  'kycStatus',
  'profilePhoto',
  'riderPhoto',
  'signature',
  'aadhaarFront',
  'aadhaarBack',
  'aadhaarNumber',
  'panCard',
  'panNumber',
  'bankAccount',
  'bankIfsc',
  'bankName',
  'accountNumber',
  'ifscCode',
  'rejectionReason',
  'editableFields',
]);

export const GUARANTOR_FIELDS = new Set([
  'guarantorStatus',
  'guarantorName',
  'guarantorRelation',
  'guarantorPhone',
  'guarantorDob',
  'guarantorAadhaarFront',
  'guarantorAadhaarBack',
  'guarantorPan',
  'guarantorVideo',
  'guarantorSignature',
  'guarantorFatherName',
  'guarantorMotherName',
  'guarantorAddress',
  'guarantorPhoto',
]);

export function processKycData(data: Record<string, unknown>): Record<string, unknown> {
  const kycData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!KYC_FIELDS.has(key)) continue;
    if (key === 'kycStatus') {
      kycData.status = value;
    } else if (['aadhaarNumber', 'panNumber', 'bankAccount', 'accountNumber', 'ifscCode', 'bankIfsc'].includes(key)) {
      kycData[key] = typeof value === 'string' && value.length > 0 ? encryptPii(sanitizeText(value)) : value;
    } else {
      kycData[key] = typeof value === 'string' ? sanitizeText(value) : value;
    }
  }
  return kycData;
}

export function processGuarantorData(data: Record<string, unknown>): Record<string, unknown> {
  const guarantorData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!GUARANTOR_FIELDS.has(key)) continue;
    if (key === 'guarantorStatus') {
      guarantorData.status = value;
    } else if (key === 'guarantorName') {
      guarantorData.name = typeof value === 'string' ? sanitizeText(value) : value;
    } else if (key === 'guarantorRelation') {
      guarantorData.relation = typeof value === 'string' ? sanitizeText(value) : value;
    } else if (key === 'guarantorPhone') {
      guarantorData.phone = value;
    } else if (key === 'guarantorDob') {
      guarantorData.dob = value;
    } else if (key === 'guarantorAadhaarFront') {
      guarantorData.aadhaarFront = value;
    } else if (key === 'guarantorAadhaarBack') {
      guarantorData.aadhaarBack = value;
    } else if (key === 'guarantorPan' || key === 'pan') {
      guarantorData.pan = typeof value === 'string' && value.length > 0 ? encryptPii(sanitizeText(value)) : value;
    } else if (key === 'guarantorVideo') {
      guarantorData.video = value;
    } else if (key === 'guarantorSignature') {
      guarantorData.signature = value;
    } else if (key === 'guarantorFatherName') {
      guarantorData.fatherName = typeof value === 'string' ? sanitizeText(value) : value;
    } else if (key === 'guarantorMotherName') {
      guarantorData.motherName = typeof value === 'string' ? sanitizeText(value) : value;
    } else if (key === 'guarantorAddress') {
      guarantorData.address = typeof value === 'string' ? sanitizeText(value) : value;
    } else if (key === 'guarantorPhoto') {
      guarantorData.photo = value;
    } else {
      guarantorData[key] = typeof value === 'string' ? sanitizeText(value) : value;
    }
  }
  return guarantorData;
}
