import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { referralRewardJob } from '../../../src/server/workers/jobs/referral-reward.job';
import { clock } from '../../../src/lib/clock';

describe('Referral Reward Job', () => {
  beforeEach(async () => {
    // PR-77: also reset the system_settings so each test starts
    // with a clean reward amount. Use TRUNCATE for the full
    // set of related tables to avoid FK Restrict on system_settings.
    await testDb.$executeRawUnsafe(`
      TRUNCATE TABLE
        "outbox_events",
        "rewards",
        "wallet_ledgers",
        "transactions",
        "wallets",
        "riders",
        "system_settings"
      RESTART IDENTITY CASCADE
    `);
    clock.reset();
  });

  it('should process referral reward and credit referrer wallet with the default amount', async () => {
    // PR-77: the job now reads `referralBonus` from system_settings,
    // defaulting to 20000 paise (₹200) when not set. This test
    // verifies the default fallback path.
    const referrerId = uuidv4();
    const referredId = uuidv4();
    const referralCode = uuidv4().slice(0, 8);
    await testDb.rider.create({
      data: {
        id: referrerId,
        riderId: uuidv4(),
        phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        referralCode,
      },
    });
    const wallet = await testDb.wallet.create({
      data: { riderId: referrerId, balanceInPaise: 0 },
    });

    const job = {
      id: 'test-job',
      payload: {
        referredRiderId: referredId,
        referralCode,
      },
    };

    const result = await referralRewardJob.process(job);

    expect(result.errors).toBe(0);
    expect(result.rewardsCredited).toBe(1);
    expect(result.referredRiders).toBe(1);

    // Default is 20000 paise (₹200) per PR-77.
    const updatedWallet = await testDb.wallet.findUnique({ where: { id: wallet.id } });
    expect(updatedWallet?.balanceInPaise).toBe(20000);

    const reward = await testDb.reward.findFirst({ where: { riderId: referrerId } });
    expect(reward).toBeDefined();
    expect(reward?.points).toBe(20000);

    const ledger = await testDb.walletLedger.findFirst({ where: { walletId: wallet.id } });
    expect(ledger?.amountInPaise).toBe(20000);

    const txn = await testDb.transaction.findFirst({ where: { riderId: referrerId } });
    expect(txn?.amountInPaise).toBe(20000);
  });

  // PR-77: when an admin changes the `referralBonus` setting,
  // the job uses the new amount. This test seeds the setting
  // explicitly and asserts the override works.
  it('PR-77: job reads the reward amount from the referralBonus setting', async () => {
    const referrerId = uuidv4();
    const referredId = uuidv4();
    const referralCode = uuidv4().slice(0, 8);
    await testDb.rider.create({
      data: {
        id: referrerId,
        riderId: uuidv4(),
        phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        referralCode,
      },
    });
    const wallet = await testDb.wallet.create({
      data: { riderId: referrerId, balanceInPaise: 0 },
    });

    // Admin sets a custom amount of 50000 paise (₹500)
    await testDb.systemSetting.create({
      data: { key: 'referralBonus', value: '50000', category: 'REWARDS' },
    });

    const job = {
      id: 'test-job',
      payload: {
        referredRiderId: referredId,
        referralCode,
      },
    };

    const result = await referralRewardJob.process(job);

    expect(result.rewardsCredited).toBe(1);
    const updatedWallet = await testDb.wallet.findUnique({ where: { id: wallet.id } });
    expect(updatedWallet?.balanceInPaise).toBe(50000);
  });

  it('should return error if payload is missing', async () => {
    const result = await referralRewardJob.process({ id: 'job', payload: {} });
    expect(result.errors).toBe(1);
    expect(result.rewardsCredited).toBe(0);
  });

  it('should return error if referrer not found', async () => {
    const job = {
      id: 'job',
      payload: { referredRiderId: uuidv4(), referralCode: 'INVALID' },
    };
    const result = await referralRewardJob.process(job);
    expect(result.errors).toBe(1);
    expect(result.rewardsCredited).toBe(0);
  });
});
