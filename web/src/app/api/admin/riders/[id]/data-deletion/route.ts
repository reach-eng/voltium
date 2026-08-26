import { randomUUID } from 'crypto';
import { requirePermission } from '@/lib/rbac';
import { success, errors } from '@/lib/api-response';
import { db } from '@/lib/db';
import { encryptPii } from '@/lib/pii-crypto';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
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

  // PR-57: write a started audit row before any destructive work.
  // The previous code only logged to console.error on failure, so
  // a successful PII destruction left no audit trail.
  const actorId = session.adminId ?? session.riderDbId ?? 'system';
  await createAuditLog({
    actorId,
    actorType: 'ADMIN',
    action: 'RIDER_DATA_DELETION_INITIATED',
    entity: 'Rider',
    entityId: riderId,
  });

  // PR-57: use crypto.randomUUID() (122 bits of entropy) instead of
  // Math.random() (≈20 bits). The Math.random() suffix was
  // brute-forceable in seconds; a collision would let a deleted
  // rider be cross-referenced with another deleted rider's
  // pseudonym. Declared outside the transaction so the success
  // audit log (written after the transaction commits) can record
  // a prefix of the suffix for forensic correlation.
  const randomSuffix = randomUUID();

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Anonymize Rider Profile
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

    // PR-57: write the success audit row after the transaction
    // commits. If the transaction rolled back, the catch block
    // will write a corresponding failure row (see below).
    await createAuditLog({
      actorId,
      actorType: 'ADMIN',
      action: 'RIDER_DATA_DELETION_COMPLETED',
      entity: 'Rider',
      entityId: riderId,
      details: { anonymizedSuffixPrefix: randomSuffix.slice(0, 8) },
    });

    return success({
      message: 'Rider data successfully anonymized/deleted.'
    });
  } catch (error) {
    logger.error('Data deletion failed:', error);
    // PR-57: write the failure audit row so a failed PII destruction
    // attempt is also auditable. The previous code only logged to
    // console.error, which is not queryable from the AuditLog
    // screen and doesn't include the actor.
    await createAuditLog({
      actorId,
      actorType: 'ADMIN',
      action: 'RIDER_DATA_DELETION_FAILED',
      entity: 'Rider',
      entityId: riderId,
      details: { error: error instanceof Error ? error.message : String(error) },
    }).catch(() => {
      // Audit log failure should not mask the original error.
    });
    return errors.internal('Failed to delete rider data');
  }
}
