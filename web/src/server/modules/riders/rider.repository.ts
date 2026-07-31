/**
 * Riders module - Repository.
 *
 * Data access for rider profiles, state, and device data.
 */

import { db } from '@/lib/db';

const ALLOWED_RIDER_UPDATE_FIELDS = new Set([
  'name',
  'email',
  'city',
  'address',
  'alternatePhone',
  'emergencyContact',
  'avatarUrl',
  'fcmToken',
  'currentHubId',
  'returnPending',
  'returnPhotos',
  'latitude',
  'longitude',
  'returnReason',
]);

export const riderRepository = {
  async findById(riderDbId: string) {
    return db.rider.findFirst({
      where: { id: riderDbId, deletedAt: null },
    });
  },

  async findByPhone(phone: string) {
    return db.rider.findFirst({
      where: { phone, deletedAt: null },
    });
  },

  async updateProfile(riderDbId: string, data: Record<string, unknown>) {
    const sanitizedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (ALLOWED_RIDER_UPDATE_FIELDS.has(key)) {
        sanitizedData[key] = value;
      }
    }
    return db.rider.update({
      where: { id: riderDbId },
      data: sanitizedData,
    });
  },

  async softDelete(riderDbId: string) {
    return db.rider.update({
      where: { id: riderDbId },
      data: { deletedAt: new Date() },
    });
  },

  async getFullState(riderDbId: string) {
    return db.rider.findFirst({
      where: { id: riderDbId, deletedAt: null },
      include: {
        kycProfile: true,
        guarantor: true,
        transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
        wallet: true,
        leases: true,
      },
    });
  },
};
