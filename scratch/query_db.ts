import { db } from '../src/lib/db';

async function main() {
  const vehicles = await db.vehicle.findMany({
    include: { hub: true },
  });
  console.log('--- VEHICLES ---');
  console.log(JSON.stringify(vehicles, null, 2));

  const hubs = await db.hub.findMany();
  console.log('--- HUBS ---');
  console.log(JSON.stringify(hubs, null, 2));
}

main().catch(console.error);
