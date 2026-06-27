import { PrismaClient } from '@prisma/client';
import { encryptPii, decryptPii } from '../src/lib/pii-crypto';

const db = new PrismaClient();

async function migrateKycProfiles() {
  console.log('Migrating KycProfiles...');
  const profiles = await db.kycProfile.findMany();
  let updatedCount = 0;

  for (const profile of profiles) {
    let changed = false;
    const dataToUpdate: any = {};

    const fields = ['aadhaarNumber', 'panNumber', 'accountNumber', 'ifscCode'] as const;

    for (const field of fields) {
      const encryptedValue = profile[field];
      if (encryptedValue && !encryptedValue.startsWith('v1:')) {
        try {
          // decryptPii will handle legacy decryption automatically
          const plainText = decryptPii(encryptedValue);
          if (plainText && plainText !== encryptedValue) {
            // encryptPii will use v1 and the new strong key
            dataToUpdate[field] = encryptPii(plainText);
            changed = true;
          }
        } catch (e) {
          console.error(`Failed to migrate ${field} for KycProfile ${profile.id}:`, e);
        }
      }
    }

    if (changed) {
      await db.kycProfile.update({
        where: { id: profile.id },
        data: dataToUpdate,
      });
      updatedCount++;
    }
  }
  console.log(`Updated ${updatedCount} KycProfiles.`);
}

async function migrateGuarantors() {
  console.log('Migrating Guarantors...');
  const guarantors = await db.guarantor.findMany();
  let updatedCount = 0;

  for (const guarantor of guarantors) {
    let changed = false;
    const dataToUpdate: any = {};

    const fields = ['pan'] as const;

    for (const field of fields) {
      const encryptedValue = guarantor[field as keyof typeof guarantor] as string | null;
      if (encryptedValue && !encryptedValue.startsWith('v1:')) {
        try {
          const plainText = decryptPii(encryptedValue);
          if (plainText && plainText !== encryptedValue) {
            dataToUpdate[field] = encryptPii(plainText);
            changed = true;
          }
        } catch (e) {
          console.error(`Failed to migrate ${field} for Guarantor ${guarantor.id}:`, e);
        }
      }
    }

    if (changed) {
      await db.guarantor.update({
        where: { id: guarantor.id },
        data: dataToUpdate,
      });
      updatedCount++;
    }
  }
  console.log(`Updated ${updatedCount} Guarantors.`);
}

async function main() {
  try {
    // We expect process.env.PII_ENCRYPTION_KEY to be set to the NEW 64-hex-char key.
    // The pii-crypto.ts decryptPii function will use the legacy fallback key automatically
    // for non-v1 ciphertexts.
    await migrateKycProfiles();
    await migrateGuarantors();
    console.log('Migration complete.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await db.$disconnect();
  }
}

main();
