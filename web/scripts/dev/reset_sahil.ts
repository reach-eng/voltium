import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Defense-in-depth: refuse to run on production data
const isProduction = process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';
if (isProduction && process.env.ALLOW_DEV_RESET !== 'true') {
  console.error('Refusing to run reset_sahil.ts in production. Set ALLOW_DEV_RESET=true to override.');
  process.exit(1);
}

async function main() {
  const sahil = await prisma.rider.findUnique({
    where: { phone: '9999999991' },
  });

  if (!sahil) {
    console.error('Rider SAHIL not found');
    return;
  }

  await prisma.rider.update({
    where: { id: sahil.id },
    data: {
      lifecycleStatus: 'PROFILE_SUBMITTED',
    },
  });

  console.log('Successfully reset SAHIL to PROFILE_SUBMITTED state!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
