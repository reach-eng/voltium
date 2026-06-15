import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Create a Hub if none exists
  const hub = await prisma.hub.upsert({
    where: { id: 'test-hub-id' },
    update: {},
    create: {
      id: 'test-hub-id',
      name: 'Main Hub',
      location: 'New Delhi',
      city: 'Delhi',
      isActive: true,
    },
  });

  // 2. Create a Vehicle
  const vehicle = await prisma.vehicle.upsert({
    where: { vehicleId: 'V-001' },
    update: { status: 'ACTIVE' },
    create: {
      vehicleId: 'V-001',
      vehicleNumber: 'DL 1S AB 1234',
      model: 'Voltium S1',
      status: 'ACTIVE',
      hubId: hub.id,
    },
  });

  // 3. Create a Rider
  const rider = await prisma.rider.upsert({
    where: { phone: '9876543210' },
    update: {
      rentalStatus: 'ACTIVE',
      vehicleId: vehicle.id,
      assignedVehicle: 'V-001',
      currentPlan: 'Monthly Pro',
    },
    create: {
      riderId: 'VF-RD-TEST',
      phone: '9876543210',
      fullName: 'Test Rider',
      referralCode: 'TESTREF',
      rentalStatus: 'ACTIVE',
      vehicleId: vehicle.id,
      assignedVehicle: 'V-001',
      currentPlan: 'Monthly Pro',
    },
  });

  // 4. Create a Pending Vehicle Return
  await prisma.vehicleReturn.create({
    data: {
      riderId: rider.id,
      vehicleId: vehicle.id,
      status: 'PENDING',
      photoFront:
        'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=60',
      photoBack:
        'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=60',
      photoLeft:
        'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=60',
      photoRight:
        'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=60',
      photoSpeedometer:
        'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=60',
    },
  });

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
