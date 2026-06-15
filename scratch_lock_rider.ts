import { db } from './src/lib/db';
import { generateRandomPassword } from './src/lib/utils';

async function main() {
  const riderId = 'rider-1';
  const newPassword = generateRandomPassword();

  const updated = await db.rider.update({
    where: { id: riderId },
    data: {
      isAdminLocked: true,
      lockPassword: newPassword,
    },
  });

  console.log('RIDER LOCKED');
  console.log('NEW PASSWORD: ' + newPassword);
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
  });
