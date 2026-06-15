import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const vehicles = await prisma.vehicle.findMany({
    include: { hub: true },
  });
  console.log(JSON.stringify(vehicles, null, 2));
}
main().finally(() => prisma.$disconnect());
