const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rider = await prisma.rider.findUnique({
    where: { id: 'rider-1' },
    select: { id: true, isAdminLocked: true, lockPassword: true },
  });
  console.log(JSON.stringify(rider, null, 2));
  await prisma.$disconnect();
}

main();
