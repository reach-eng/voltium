import { db } from '@/lib/db';
import { lifecycleRankOf } from '@/lib/lifecycle-ranks';

const SCORE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function calculateRiderScore(riderId: string, forceRecalculate = false) {
  if (!forceRecalculate) {
    const existing = await db.riderScore.findUnique({ where: { riderId } }).catch(() => null);
    if (existing && Date.now() - existing.lastCalculated.getTime() < SCORE_CACHE_TTL_MS) {
      return existing;
    }
  }

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
      riskLevel: riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      lastCalculated: new Date(),
    },
    create: {
      riderId,
      paymentScore,
      kycScore,
      activityScore,
      supportScore,
      compositeScore,
      riskLevel: riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    },
  });

  return score;
}

export function calculatePaymentScore(rider: any): number {
  if (!rider.wallet) return 0;

  const streak = rider.wallet.paymentStreak || 0;
  const depositStatus = rider.wallet.depositStatus || 'PENDING';

  let score = 0;
  if (depositStatus === 'APPROVED') score += 40;
  else if (depositStatus === 'PARTIALLY_REFUNDED') score += 20;

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

export function calculateKycScore(rider: any): number {
  if (!rider.kycProfile) return 0;

  const kyc = rider.kycProfile;
  let score = 0;

  if (kyc.status === 'APPROVED') score = 100;
  else if (kyc.status === 'SUBMITTED') score = 70;
  else if (kyc.status === 'PENDING') score = 50;
  else if (kyc.status === 'REJECTED') score = 20;
  else if (kyc.status === 'INFO_REQUIRED') score = 30;

  if (kyc.aadhaarFront && kyc.aadhaarBack) score = Math.min(score + 10, 100);
  if (kyc.panCard) score = Math.min(score + 5, 100);
  if (kyc.profilePhoto) score = Math.min(score + 5, 100);

  return Math.round(score * 100) / 100;
}

export function calculateActivityScore(rider: any): number {
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

  // P1-12: shared lifecycle ranking (single source of truth).
  const rank = lifecycleRankOf(rider.lifecycleStatus);
  if (rank >= 11) score += 30;
  else if (rank >= 2) score += 15;

  return Math.min(Math.round(score * 100) / 100, 100);
}

export function calculateSupportScore(rider: any): number {
  const totalTickets = rider.tickets?.length || 0;
  const openTickets = rider.tickets?.filter((t: any) => t.status === 'OPEN').length || 0;

  let score = 100;

  score -= totalTickets * 5;
  score -= openTickets * 10;

  return Math.max(Math.min(Math.round(score * 100) / 100, 100), 0);
}
