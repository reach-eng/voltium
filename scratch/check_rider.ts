import { db } from '../src/lib/db';

async function main() {
  const rider = await db.rider.findFirst({
    where: { phone: '7788888802' },
    include: { kycProfile: true, wallet: true },
  });
  console.log('RIDER:', {
    id: rider?.id,
    fullName: rider?.fullName,
    phone: rider?.phone,
    rentalStatus: rider?.rentalStatus,
    accountStatus: rider?.accountStatus,
    teamLeader: rider?.teamLeader,
    pickupHub: rider?.pickupHub,
    pickupDone: rider?.pickupDone,
  });

  const teamLeaders = await db.teamLeader.findMany();
  console.log('TEAM LEADERS IN DB:', teamLeaders);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
