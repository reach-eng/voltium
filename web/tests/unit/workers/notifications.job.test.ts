import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { testDb } from '../../_setup/test-postgres';
import { clock } from '../../../src/lib/clock';
import { notificationsJob } from '../../../src/server/workers/jobs/notifications.job';
import { v4 as uuidv4 } from 'uuid';

describe('Notifications Job (Deprecated)', () => {
  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
  });

  afterAll(async () => {
  });

  beforeEach(async () => {
    await testDb.idempotencyKey.deleteMany();
    await testDb.wallet.deleteMany();
    await testDb.rider.deleteMany();
    clock.reset();
  });

  it('should process birthdays and payment reminders and return result', async () => {
    // Rider 1: Birthday today, positive balance
    const riderId1 = uuidv4();
    await testDb.rider.create({ data: { id: riderId1, riderId: uuidv4(), referralCode: uuidv4().slice(0, 8), phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`, dob: '29-06-1990', lifecycleStatus: 'ACTIVE', fullName: 'R1' } });
    await testDb.wallet.create({ data: { riderId: riderId1, balanceInPaise: 100 } });

    clock.set({ now: () => new Date('2026-06-29T10:00:00Z') }); // 2026-06-29

    const result = await notificationsJob.process({ id: 'test' });
    
    expect(result.birthdays).toBe(1);
    // Deprecated logic has a slightly different way or might not even mock notification service, 
    // but the db logic should match 1 birthday.
    expect(result.referralLeaderboard).toBe(1);
  });
});
