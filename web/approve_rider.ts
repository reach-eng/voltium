
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function approveRider() {
  const rider = await prisma.rider.findFirst({
    orderBy: { createdAt: "desc" }
  });
  
  if (!rider) {
    console.log("No rider found");
    return;
  }
  
  await prisma.rider.update({
    where: { id: rider.id },
    data: { lifecycleStatus: "ACTIVE" }
  });
  
  await prisma.kycProfile.updateMany({
    where: { riderId: rider.id },
    data: { status: "APPROVED" }
  });
  
  await prisma.guarantor.updateMany({
    where: { riderId: rider.id },
    data: { status: "APPROVED" }
  });
  
  console.log("Rider approved:", rider.phone);
}
approveRider().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

