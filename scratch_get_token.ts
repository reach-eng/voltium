import { db } from './src/lib/db';
import { createSessionToken } from './src/lib/auth';

async function main() {
  const admin = await db.admin.findUnique({
    where: { email: 'superadmin@voltium.in' },
  });

  if (!admin) {
    console.error('Superadmin not found');
    return;
  }

  const token = createSessionToken({
    riderId: admin.id,
    riderDbId: admin.id,
    phone: admin.email,
    role: 'admin',
    adminRole: admin.role,
    adminId: admin.id,
  });

  console.log('TOKEN:' + token);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
