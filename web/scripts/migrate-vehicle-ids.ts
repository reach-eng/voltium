import { db } from '@/lib/db';

async function migrate() {
  const riders = await db.rider.findMany({
    where: {
      assignedVehicle: {
        startsWith: 'VF-',
      },
    },
  });

  console.log(`Found ${riders.length} riders with VF- assigned vehicles.`);

  for (const rider of riders) {
    if (rider.assignedVehicle) {
      const v = await db.vehicle.findUnique({
        where: { vehicleId: rider.assignedVehicle },
      });
      if (v) {
        await db.rider.update({
          where: { id: rider.id },
          data: { assignedVehicle: v.vehicleNumber },
        });
        console.log(`Updated rider ${rider.phone}: ${rider.assignedVehicle} -> ${v.vehicleNumber}`);
      }
    }
  }

  console.log('Migration complete.');
}

migrate()
  .catch(console.error)
  .finally(() => process.exit(0));
