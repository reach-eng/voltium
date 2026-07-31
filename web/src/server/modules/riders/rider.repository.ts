/**
 * Riders module - Repository.
 *
 * Data access for rider profiles, state, and device data.
 */

import { db } from '@/lib/db';

export const riderRepository = {
  async findById(riderDbId: string) {
    return db.rider.findUnique({ where: { id: riderDbId } });
  },

  async findByPhone(phone: string) {
    return db.rider.findUnique({ where: { phone } });
  },

  async updateProfile(riderDbId: string, data: Record<string, unknown>) {
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
