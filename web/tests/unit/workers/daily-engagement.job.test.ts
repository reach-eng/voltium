import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { testDb } from '../../_setup/test-postgres';
import { clock } from '../../../src/lib/clock';
import { dailyEngagementJob } from '../../../src/server/workers/jobs/daily-engagement.job';
import { notificationService } from '../../../src/lib/notification-service';
import { v4 as uuidv4 } from 'uuid';

vi.mock('../../../src/lib/notification-service', () => ({
  notificationService: {
    notifyBirthdayWish: vi.fn().mockResolvedValue(true),
    notifyPaymentReminder: vi.fn().mockResolvedValue(true),
    notifyReferralUpdate: vi.fn().mockResolvedValue(true),
  }
}));

describe('Daily Engagement Job', () => {
  beforeAll(async () => {
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await testDb.idempotencyKey.deleteMany();
    await testDb.wallet.deleteMany();
    await testDb.rider.deleteMany();
    clock.reset();
    vi.clearAllMocks();
  });

  it('should process birthdays and payment reminders', async () => {
    // Set fixed clock so we know the IST date
    clock.set({ now: () => new Date('2026-06-29T10:00:00Z') }); // 2026-06-29
    
    // Rider 1: Birthday today, positive balance
    const riderId1 = uuidv4();
    await testDb.rider.create({ data: { id: riderId1, riderId: uuidv4(), referralCode: uuidv4().slice(0, 8), phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`, dob: '29-06-1990', lifecycleStatus: 'ACTIVE', fullName: 'R1' } });
    await testDb.wallet.create({ data: { riderId: riderId1, balanceInPaise: 100 } });

    // Rider 2: Negative balance, no birthday
    const riderId2 = uuidv4();
    await testDb.rider.create({ data: { id: riderId2, riderId: uuidv4(), referralCode: uuidv4().slice(0, 8), phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`, dob: '01-01-1990', lifecycleStatus: 'ACTIVE', fullName: 'R2' } });
    await testDb.wallet.create({ data: { riderId: riderId2, balanceInPaise: -500 } });

    const result = await dailyEngagementJob.process({ id: 'test' });
    
    expect(result.birthdays).toBe(1);
    expect(result.paymentReminders).toBe(1);
    expect(result.referralLeaderboard).toBe(1);

    expect(notificationService.notifyBirthdayWish).toHaveBeenCalledWith(riderId1, 'R1');
    expect(notificationService.notifyPaymentReminder).toHaveBeenCalledWith(riderId2, 500, 'overdue');
    expect(notificationService.notifyReferralUpdate).toHaveBeenCalled();
  });

  it('should not process twice on the same day', async () => {
    clock.set({ now: () => new Date('2026-06-29T10:00:00Z') }); // 2026-06-29

    await dailyEngagementJob.process({ id: 'test-1' });
    const result2 = await dailyEngagementJob.process({ id: 'test-2' });

    expect(result2.birthdays).toBe(0);
    expect(result2.paymentReminders).toBe(0);
    expect(result2.referralLeaderboard).toBe(0);
  });

  it('should continue processing even if a notification fails', async () => {
    clock.set({ now: () => new Date('2026-06-30T10:00:00Z') }); // 2026-06-30
    
    const riderId1 = uuidv4();
    await testDb.rider.create({ data: { id: riderId1, riderId: uuidv4(), referralCode: uuidv4().slice(0, 8), phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`, dob: '30-06-1990', lifecycleStatus: 'ACTIVE', fullName: 'FailRider' } });
    await testDb.wallet.create({ data: { riderId: riderId1, balanceInPaise: 100 } });

    vi.mocked(notificationService.notifyBirthdayWish).mockRejectedValueOnce(new Error('FCM Failed'));

    const result = await dailyEngagementJob.process({ id: 'test' });
    expect(result.birthdays).toBe(1); // the loop completed and incremented it
  });
});

import { msUntilNext0600IST } from '../../../src/server/workers/jobs/daily-engagement.job';

describe('msUntilNext0600IST', () => {
  it('should return milliseconds to 06:00 IST today if current time is before 06:00 IST', () => {
    // 00:00 UTC = 05:30 IST. 06:00 IST is 00:30 UTC.
    const now = new Date('2026-06-29T00:00:00Z');
    const msUntil = msUntilNext0600IST(now);
    // 30 mins * 60 * 1000 = 1800000 ms
    expect(msUntil).toBe(1800000);
  });

  it('should return milliseconds to 06:00 IST tomorrow if current time is after 06:00 IST', () => {
    // 01:00 UTC = 06:30 IST. Next 06:00 IST is tomorrow 00:30 UTC.
    const now = new Date('2026-06-29T01:00:00Z');
    const msUntil = msUntilNext0600IST(now);
    // 23 hours 30 mins = 23.5 * 3600 * 1000 = 84600000 ms
    expect(msUntil).toBe(84600000);
  });
});
