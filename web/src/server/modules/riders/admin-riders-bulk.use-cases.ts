/**
 * Admin Riders — Bulk / Delete Operations
 *
 * Delete a rider with cascade clean-up of related records.
 */

import { db } from '@/lib/db';

/**
 * Delete a rider with cascade clean-up of related records.
 */
export async function deleteRider(id: string) {
  await db.$transaction([
    db.notification.deleteMany({ where: { riderId: id } }),
    db.rentalLease.deleteMany({ where: { riderId: id } }),
    db.guarantor.deleteMany({ where: { riderId: id } }),
    db.kycProfile.deleteMany({ where: { riderId: id } }),
    db.wallet.deleteMany({ where: { riderId: id } }),
    db.rider.delete({ where: { id } }),
  ]);
}
