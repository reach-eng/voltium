import { requirePermission } from '@/lib/rbac';
import { success, errors } from '@/lib/api-response';
import { db } from '@/lib/db';
import { encryptPii } from '@/lib/pii-crypto';
import type { Prisma } from '@prisma/client';

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission('admin:write');
  if (!session) {
    return errors.forbidden('Insufficient permissions to delete rider data');
  }

  const { id: riderId } = await context.params;

  const rider = await db.rider.findUnique({
    where: { id: riderId },
    include: {
      kycProfile: true,
      wallet: true,
      leases: {
        where: { status: 'ACTIVE' }
      }
    }
  });

  if (!rider) {
    return errors.notFound('Rider not found');
  }

  // Ensure no active rentals
  if (rider.leases.length > 0) {
    return errors.badRequest('Cannot delete rider with an active rental');
  }

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Anonymize Rider Profile
      const randomSuffix = Math.floor(Math.random() * 1000000).toString();
      const anonymizedPhone = encryptPii(`DELETED-${randomSuffix}`) ?? `DELETED-${randomSuffix}`;
      const anonymizedEmail =
        encryptPii(`deleted-${randomSuffix}@voltium.app`) ?? `deleted-${randomSuffix}@voltium.app`;

      await tx.rider.update({
        where: { id: riderId },
        data: {
          phone: anonymizedPhone,
          email: anonymizedEmail,
          fullName: 'Deleted User',
          fcmToken: null,
          lifecycleStatus: 'CLOSED'
        }
      });

      // 2. Anonymize KYC (delete documents, scramble PAN/Aadhaar)
      if (rider.kycProfile) {
        await tx.kycProfile.update({
          where: { riderId: riderId },
          data: {
            aadhaarNumber: encryptPii(`DELETED-${randomSuffix}`),
            panNumber: encryptPii(`DELETED-${randomSuffix}`),
            accountNumber: encryptPii(`DELETED-${randomSuffix}`),
            ifscCode: encryptPii(`DELETED-${randomSuffix}`),
            profilePhoto: null,
            riderPhoto: null,
            signature: null,
            aadhaarFront: null,
            aadhaarBack: null,
            panCard: null,
            status: 'REJECTED',
            rejectionReason: 'Data deleted upon request'
          }
        });
      }

      // 3. Clear sensitive device/auth sessions
      await tx.deviceViolation.deleteMany({
        where: { riderId: riderId }
      });
      await tx.userCallLog.deleteMany({
        where: { riderId: riderId }
      });
      await tx.userContact.deleteMany({
        where: { riderId: riderId }
      });
      await tx.userLocation.deleteMany({
        where: { riderId: riderId }
      });
    });

    return success({
      message: 'Rider data successfully anonymized/deleted.'
    });
  } catch (error) {
    console.error('Data deletion failed:', error);
    return errors.internal('Failed to delete rider data');
  }
}
