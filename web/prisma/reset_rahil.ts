import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const rahil = await prisma.rider.findUnique({
    where: { phone: '9999999991' },
  });

  if (!rahil) {
    console.error('Rider RAHIL not found');
    return;
  }

  await prisma.rider.update({
    where: { id: rahil.id },
    data: {
      accountStatus: 'PRE_ACTIVE',
      state: 'PRE_ACTIVE',
      registrationDone: true,
      kycDone: false,
      depositDone: false,
      planDone: false,
      pickupDone: false,
      vehicleId: null,
      assignedVehicle: null,
      currentPlan: null,
      pickedUpAt: null,
      depositDoneAt: null,
      kycDoneAt: null,
      planDoneAt: null,
    },
  });

  console.log('Successfully reset RAHIL to PRE_ACTIVE state!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
