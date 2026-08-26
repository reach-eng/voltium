/**
 * Rider — Registration & Token Management
 *
 * FCM token registration and other registration-related use-cases.
 */

import { db } from '@/lib/db';
import { NotFoundError } from "@/lib/api-error";

/**
 * Register FCM token for a rider.
 *
 * `riderDbId` must be the internal database id (the `riderDbId` claim
 * from the verified session), not the public `riderId`. Callers (e.g. the
 * /api/rider/register-token route) are responsible for ensuring this.
 */
export async function registerFcmToken(riderDbId: string, fcmToken: string) {
  const rider = await db.rider.findUnique({ where: { id: riderDbId } });
  if (!rider) throw new NotFoundError('Rider not found');
  await db.rider.update({ where: { id: riderDbId }, data: { fcmToken } });
}
