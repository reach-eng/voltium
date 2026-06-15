import { db } from '@/lib/db';

export async function calculateRiderScore(riderId: string) {
  const rider = await db.rider.findUnique({
    where: { id: riderId },
    include: {
      wallet: true,
      kycProfile: true,
      leases: { take: 50, orderBy: { createdAt: 'desc' } },
      tickets: { take: 50, orderBy: { createdAt: 'desc' } },
      transactions: { take: 50, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!rider) throw new Error('Rider not found');

  const paymentScore = calculatePaymentScore(rider);
  const kycScore = calculateKycScore(rider);
  const activityScore = calculateActivityScore(rider);
  const supportScore = calculateSupportScore(rider);

  const compositeScore =
    paymentScore * 0.3 + kycScore * 0.25 + activityScore * 0.25 + supportScore * 0.2;

  let riskLevel = 'LOW';
  if (compositeScore < 30) riskLevel = 'CRITICAL';
  else if (compositeScore < 50) riskLevel = 'HIGH';
  else if (compositeScore < 70) riskLevel = 'MEDIUM';

  const score = await db.riderScore.upsert({
    where: { riderId },
    update: {
      paymentScore,
      kycScore,
      activityScore,
      supportScore,
      compositeScore,
      riskLevel,
      lastCalculated: new Date(),
    },
    create: {
      riderId,
      paymentScore,
      kycScore,
      activityScore,
      supportScore,
      compositeScore,
      riskLevel,
    },
  });

  return score;
}

function calculatePaymentScore(rider: any): number {
  if (!rider.wallet) return 0;

  const streak = rider.wallet.paymentStreak || 0;
  const depositStatus = rider.wallet.depositStatus || 'PENDING';

  let score = 0;
  if (depositStatus === 'PAID') score += 40;
  else if (depositStatus === 'PARTIAL') score += 20;

  score += Math.min(streak * 5, 60);

  const completedTx = rider.transactions?.filter((t: any) => t.status === 'COMPLETED').length || 0;
  const failedTx = rider.transactions?.filter((t: any) => t.status === 'FAILED').length || 0;
  const totalTx = completedTx + failedTx;

  if (totalTx > 0) {
    const successRate = completedTx / totalTx;
    score += successRate * 20;
  }

  return Math.min(Math.round(score * 100) / 100, 100);
}

function calculateKycScore(rider: any): number {
  if (!rider.kycProfile) return 0;

  const kyc = rider.kycProfile;
  let score = 0;

  if (kyc.status === 'APPROVED') score = 100;
  else if (kyc.status === 'PENDING') score = 50;
  else if (kyc.status === 'REJECTED') score = 20;
  else if (kyc.status === 'INFO_REQUIRED') score = 30;

  if (kyc.aadhaarFront && kyc.aadhaarBack) score = Math.min(score + 10, 100);
  if (kyc.panCard) score = Math.min(score + 5, 100);
  if (kyc.profilePhoto) score = Math.min(score + 5, 100);

  return Math.round(score * 100) / 100;
}

function calculateActivityScore(rider: any): number {
  let score = 0;

  const accountAge = Date.now() - new Date(rider.createdAt).getTime();
  const daysActive = accountAge / (1000 * 60 * 60 * 24);

  if (daysActive > 365) score += 30;
  else if (daysActive > 180) score += 25;
  else if (daysActive > 90) score += 20;
  else if (daysActive > 30) score += 15;
  else score += 10;

  const activeLeases = rider.leases?.filter((l: any) => l.status === 'ACTIVE').length || 0;
  if (activeLeases > 0) score += 40;

  if (rider.accountStatus === 'POST_ACTIVE') score += 30;
  else if (rider.accountStatus === 'PRE_ACTIVE') score += 15;

  return Math.min(Math.round(score * 100) / 100, 100);
}

function calculateSupportScore(rider: any): number {
  const totalTickets = rider.tickets?.length || 0;
  const openTickets = rider.tickets?.filter((t: any) => t.status === 'OPEN').length || 0;

  let score = 100;

  score -= totalTickets * 5;
  score -= openTickets * 10;

  return Math.max(Math.min(Math.round(score * 100) / 100, 100), 0);
}
