/**
 * Admin Riders — Create, Update & Status Actions
 *
 * Create a new rider, update rider profile/status with field-level security,
 * assign plans, complete pickups, end rentals, and update security flags.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { flattenRider as sharedFlattenRider } from '@/lib/flatten-rider';
import { sanitizeText } from '@/lib/sanitize';
import { transitionRiderStatus } from '@/server/modules/riders/rider-lifecycle.service';
import { extractKycData, getKycLifecycleSync, logKycAuditAndNotify } from './admin-riders-kyc-actions.use-cases';
import { extractWalletData, adjustWalletInTransaction } from './admin-riders-wallet-adjust.use-cases';
import { NotFoundError, ValidationError } from "@/lib/api-error";

// Field allowlists for mass-assignment protection
const SAFE_RIDER_FIELDS = new Set([
  'fullName',
  'email',
  'fatherName',
  'motherName',
  'dob',
  'currentAddress',
  'emergencyContact',
  'pickupHub',
  'teamLeader',
  'planStartDate',
  'planEndDate',
  'intent',
  'referralCode',
  'phone',
  'preferredShift',
  'referredBy',
  'assignedVehicle',
]);

const GUARANTOR_FIELDS = new Set([
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

function extractRiderData(data: Record<string, unknown>): Record<string, unknown> {
  const riderData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SAFE_RIDER_FIELDS.has(key)) {
      riderData[key] = typeof value === 'string' ? sanitizeText(value) : value;
    }
  }
  return riderData;
}

function extractGuarantorData(data: Record<string, unknown>): Record<string, unknown> {
  const guarantorData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!GUARANTOR_FIELDS.has(key)) continue;
    if (key === 'guarantorStatus') guarantorData.status = value;
    else if (key === 'guarantorName')
      guarantorData.name = typeof value === 'string' ? sanitizeText(value) : value;
    else if (key === 'guarantorRelation')
      guarantorData.relation = typeof value === 'string' ? sanitizeText(value) : value;
    else if (key === 'guarantorPhone') guarantorData.phone = value;
    else if (key === 'guarantorDob') guarantorData.dob = value;
    else if (key === 'guarantorAadhaarFront') guarantorData.aadhaarFront = value;
    else if (key === 'guarantorAadhaarBack') guarantorData.aadhaarBack = value;
    else if (key === 'guarantorPan') guarantorData.pan = value;
    else if (key === 'guarantorVideo') guarantorData.video = value;
    else if (key === 'guarantorSignature') guarantorData.signature = value;
    else if (key === 'guarantorFatherName')
      guarantorData.fatherName = typeof value === 'string' ? sanitizeText(value) : value;
    else if (key === 'guarantorMotherName')
      guarantorData.motherName = typeof value === 'string' ? sanitizeText(value) : value;
    else if (key === 'guarantorAddress')
      guarantorData.address = typeof value === 'string' ? sanitizeText(value) : value;
    else if (key === 'guarantorPhoto') guarantorData.photo = value;
    else guarantorData[key] = typeof value === 'string' ? sanitizeText(value) : value;
  }
  return guarantorData;
}


/**
 * Update a rider with field-level security.
 * Handles safe rider fields, KYC fields, wallet fields (with ledger-backed mutations),
 * guarantor fields, KYC status notifications, and audit logging.
 */
export async function updateRider(
  id: string,
  data: Record<string, unknown>,
  context: { actorId: string; actorRole: string }
) {
  const { actorId } = context;

  const existing = await db.rider.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Rider not found');

  const riderData = extractRiderData(data);
  const kycData = extractKycData(data);
  const walletData = extractWalletData(data);
  const guarantorData = extractGuarantorData(data);

  // Sync lifecycleStatus with KycProfile status
  const { riderPatch, guarantorPatch } = getKycLifecycleSync(kycData.status as string | undefined);
  Object.assign(riderData, riderPatch);
  Object.assign(guarantorData, guarantorPatch);

  if (riderData.phone && riderData.phone !== existing.phone) {
    const duplicatePhone = await db.rider.findFirst({
      where: { phone: riderData.phone, NOT: { id } },
      select: { id: true },
    });
    if (duplicatePhone) {
      throw new ValidationError(`Phone number ${riderData.phone} is already registered to another rider.`);
    }
  }

  if (riderData.lifecycleStatus && riderData.lifecycleStatus !== existing.lifecycleStatus) {
    transitionRiderStatus(existing.lifecycleStatus as any, riderData.lifecycleStatus as any);
  }

  const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    if (Object.keys(riderData).length > 0) {
      if (riderData.fullName && existing.riderId.startsWith('VF-RD-')) {
        const name = riderData.fullName as string;
        const prefix = name.replace(/[^a-zA-Z]/g, '').padEnd(2, 'X').substring(0, 2).toUpperCase();
        riderData.riderId = `VEM${prefix}${String(existing.serialNumber).padStart(3, '0')}`;
      }
      await tx.rider.update({ where: { id }, data: riderData });
    }
    if (Object.keys(kycData).length > 0) {
      await tx.kycProfile.upsert({
        where: { riderId: id },
        update: kycData,
        create: { riderId: id, ...kycData },
      });
    }
    if (Object.keys(walletData).length > 0) {
      await adjustWalletInTransaction(tx, id, walletData, actorId);
    }
    if (Object.keys(guarantorData).length > 0) {
      await tx.guarantor.upsert({
        where: { riderId: id },
        update: guarantorData,
        create: { riderId: id, ...guarantorData },
      });
    }
    return tx.rider.findUnique({
      where: { id },
      include: { kycProfile: true, wallet: true, guarantor: true },
    });
  });

  // Audit log for KYC actions
  await logKycAuditAndNotify(id, kycData.status as string, kycData.rejectionReason as string | undefined, actorId);

  return sharedFlattenRider(result as any);
}

