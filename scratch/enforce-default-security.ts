import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration: Enforcing default security for all riders...');

  const result = await prisma.rider.updateMany({
    data: {
      isUninstallBlocked: true,
      isLocationMandatory: true,
      isAppsControlRestricted: true,
    },
  });

  console.log(`Successfully updated ${result.count} riders.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
