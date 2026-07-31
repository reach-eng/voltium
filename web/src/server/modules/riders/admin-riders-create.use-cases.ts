import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { flattenRider as sharedFlattenRider } from '@/lib/flatten-rider';
import { sanitizeText } from '@/lib/sanitize';
import { ConflictError } from "@/lib/api-error";

/**
 * Create a new rider with associated wallet, KYC, and guarantor records.
 */
export async function createRider(input: { phone: string; fullName?: string }) {
  const { phone, fullName } = input;

  const existing = await db.rider.findUnique({ where: { phone } });
  if (existing) throw new ConflictError('Phone already exists');

  const riderId = `VF-RD-${randomUUID().slice(0, 8).toUpperCase()}`;

  const rider = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    let created = await tx.rider.create({
      data: {
        phone,
        fullName: fullName ? sanitizeText(fullName) : null,
        riderId,
        referralCode: `VFR-${randomUUID().slice(0, 6).toUpperCase()}`,
      },
    });

    if (fullName) {
      const prefix = fullName.replace(/[^a-zA-Z]/g, '').padEnd(2, 'X').substring(0, 2).toUpperCase();
      const newRiderId = `VEM${prefix}${String(created.serialNumber).padStart(3, '0')}`;
      created = await tx.rider.update({
        where: { id: created.id },
        data: { riderId: newRiderId },
      });
    }

    await tx.wallet.create({ data: { riderId: created.id } });
    await tx.kycProfile.create({ data: { riderId: created.id } });
    await tx.guarantor.create({ data: { riderId: created.id } });

    return tx.rider.findUnique({
      where: { id: created.id },
      include: { kycProfile: true, wallet: true, guarantor: true },
    });
  });

  return sharedFlattenRider(rider as any);
}
