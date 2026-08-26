/**
 * Riders module - Repository.
 *
 * Data access for rider profiles, state, and device data.
 */

import { db } from '@/lib/db';
import { getCachedRider, invalidateRiderCache } from '@/lib/server-cache';

export const riderRepository = {
  async findById(riderDbId: string) {
    return getCachedRider(riderDbId, () =>
      db.rider.findUnique({ where: { id: riderDbId } })
    );
  },

  async findByPhone(phone: string) {
    return db.rider.findUnique({ where: { phone } });
  },

  async updateProfile(riderDbId: string, data: Record<string, unknown>) {
    invalidateRiderCache(riderDbId);
    return db.rider.update({
      where: { id: riderDbId },
      data,
    });
  },

  async getFullState(riderDbId: string) {
    return db.rider.findUnique({
      where: { id: riderDbId },
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
