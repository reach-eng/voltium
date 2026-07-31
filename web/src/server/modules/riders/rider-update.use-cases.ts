/**
 * Rider — Profile Updates
 *
 * Update rider profile with field-level security.
 * Handles safe rider fields, KYC fields, guarantor fields, and vehicle returns.
 */

import { db } from '@/lib/db';
import { flattenRider } from '@/lib/flatten-rider';
import { sanitizeText } from '@/lib/sanitize';
import { transitionRiderStatus } from '@/server/modules/riders/rider-lifecycle.service';
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
  'intent',
  'locationGranted',
  'batteryGranted',
  'contactsGranted',
  'callLogsGranted',
  'micGranted',
  'cameraGranted',
  'phoneGranted',
]);

const SAFE_KYC_FIELDS = new Set([
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
  'selfie',
]);

const SAFE_GUARANTOR_FIELDS = new Set([
  'guarantorName',
  'guarantorPhone',
  'guarantorRelation',
  'guarantorDob',
  'guarantorFatherName',
  'guarantorMotherName',
  'guarantorAddress',
  'guarantorAadhaarFront',
  'guarantorAadhaarBack',
  'guarantorPan',
  'guarantorVideo',
  'guarantorSignature',
  'guarantorPhoto',
  'guarantorStatus',
]);

/**
 * Update rider profile with field-level security.
 * Handles safe rider fields, KYC fields, guarantor fields, and vehicle returns.
 */
export async function updateProfile(riderDbId: string, input: Record<string, unknown>) {
  const existing = await db.rider.findUnique({ where: { id: riderDbId } });
  if (!existing) throw new NotFoundError('Rider not found');

  const riderData: Record<string, unknown> = {};
  const kycData: Record<string, unknown> = {};
  const guarantorData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;

    if (SAFE_RIDER_FIELDS.has(key)) {
      riderData[key] = typeof value === 'string' ? sanitizeText(value) : value;
    } else if (SAFE_KYC_FIELDS.has(key)) {
      if (key === 'bankAccount') kycData['accountNumber'] = value;
      else if (key === 'bankIfsc') kycData['ifscCode'] = value;
      else if (key === 'selfie') kycData['profilePhoto'] = value;
      else kycData[key] = value;
    } else if (SAFE_GUARANTOR_FIELDS.has(key)) {
      const dbKey = key.charAt(9).toLowerCase() + key.slice(10);
      guarantorData[dbKey] = value;
    }
  }

  // Update core rider fields
  if (Object.keys(riderData).length > 0) {
    if (riderData.fullName && existing.riderId.startsWith('VF-RD-')) {
      const name = riderData.fullName as string;
      const prefix = name.replace(/[^a-zA-Z]/g, '').padEnd(2, 'X').substring(0, 2).toUpperCase();
      riderData.riderId = `VEM${prefix}${String(existing.serialNumber).padStart(3, '0')}`;
    }
    await db.rider.update({ where: { id: riderDbId }, data: riderData });
  }

  // Handle vehicle returns
  if (input.returnPending === true && (input.returnPhotos as string[] | undefined)?.length) {
    const photos = input.returnPhotos as string[];
    let vehicleId = existing.vehicleId || null;
    if (!vehicleId && existing.assignedVehicle) {
      const vehicle = await db.vehicle.findFirst({
        where: {
          OR: [
            { vehicleId: existing.assignedVehicle },
            { vehicleNumber: existing.assignedVehicle },
          ],
        },
        select: { id: true },
      });
      vehicleId = vehicle?.id || null;
    }
    if (!vehicleId) throw new ValidationError('No vehicle assigned to this rider');

    const parsedEndOdo = typeof input.endOdometer === 'number' ? input.endOdometer : typeof input.odometer === 'number' ? input.odometer : undefined;

    await db.vehicleReturn.create({
      data: {
        riderId: riderDbId,
        vehicleId,
        status: 'SUBMITTED',
        photoLeft: photos[0],
        photoRight: photos[1],
        photoFront: photos[2],
        photoSpeedometer: photos[3],
        latitude: input.latitude as number | undefined,
        longitude: input.longitude as number | undefined,
        reason: (input.returnReason as string) || 'End of rental',
        ...(typeof parsedEndOdo === 'number' ? { endOdometer: parsedEndOdo } : {}),
      },
    });

    await transitionRiderStatus(riderDbId, 'RETURN_PENDING');
  }

  // Update KYC profile
  if (Object.keys(kycData).length > 0) {
    await db.kycProfile.upsert({
      where: { riderId: riderDbId },
      create: { riderId: riderDbId, ...(kycData as any), status: 'SUBMITTED' },
      update: { ...(kycData as any), status: 'SUBMITTED' },
    });
  }

  // Update Guarantor
  if (Object.keys(guarantorData).length > 0) {
    if (guarantorData.phone && (guarantorData.phone as string).replaceAll(/\D/g, '') === existing.phone.replaceAll(/\D/g, '')) {
      throw new ValidationError('Guarantor phone number cannot be identical to rider phone number');
    }
    if (!guarantorData.relation) guarantorData.relation = 'Other';
    await db.guarantor.upsert({
      where: { riderId: riderDbId },
      create: {
        riderId: riderDbId,
        name: (guarantorData.name as string) || 'N/A',
        relation: (guarantorData.relation as string) || 'Other',
        phone: (guarantorData.phone as string) || '0000000000',
        ...(guarantorData as any),
        status: 'SUBMITTED',
      },
      update: { ...(guarantorData as any), status: 'SUBMITTED' },
    });
  }

  // Advance lifecycle based on submissions
  const currentRider = await db.rider.findUnique({ where: { id: riderDbId }, select: { lifecycleStatus: true } });
  
  if (currentRider) {
    // 1. If Guarantor data is present, move from PROFILE_SUBMITTED to GUARANTOR_SUBMITTED (Guarantor Form completed)
    if (Object.keys(guarantorData).length > 0) {
      const freshStatus = await db.rider.findUnique({ where: { id: riderDbId }, select: { lifecycleStatus: true } });
      if (freshStatus?.lifecycleStatus === 'PROFILE_SUBMITTED') {
        await transitionRiderStatus(riderDbId, 'GUARANTOR_SUBMITTED');
      }
    }

    // 2. If KYC data is present, move from DEPOSIT_APPROVED to KYC_SUBMITTED (KYC Form completed)
    if (Object.keys(kycData).length > 0) {
      if (currentRider.lifecycleStatus === 'NEW') {
        await transitionRiderStatus(riderDbId, 'PHONE_VERIFIED');
      }
      
      const freshStatus = await db.rider.findUnique({ where: { id: riderDbId }, select: { lifecycleStatus: true } });
      if (freshStatus?.lifecycleStatus === 'PHONE_VERIFIED' || freshStatus?.lifecycleStatus === 'NEW') {
        await transitionRiderStatus(riderDbId, 'PROFILE_SUBMITTED');
      }
      
      if (freshStatus?.lifecycleStatus === 'DEPOSIT_APPROVED') {
        await transitionRiderStatus(riderDbId, 'KYC_SUBMITTED');
      }
    }
  }

  // Return updated profile
  const rider = await db.rider.findUnique({
    where: { id: riderDbId },
    include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
  });
  if (!rider) return null;
  const flatRider = flattenRider(rider);
  let assignedVehicleNumber = flatRider.assignedVehicle;
  if (flatRider.assignedVehicle) {
    const v = await db.vehicle.findUnique({ where: { vehicleId: flatRider.assignedVehicle } });
    if (v) assignedVehicleNumber = v.vehicleNumber;
  }
  flatRider.assignedVehicle = assignedVehicleNumber;
  return flatRider;
}
