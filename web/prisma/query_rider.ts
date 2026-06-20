import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const riders = await prisma.rider.findMany({
    include: { kycProfile: true, wallet: true, guarantor: true },
  });
  console.log(JSON.stringify(riders, null, 2));
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
