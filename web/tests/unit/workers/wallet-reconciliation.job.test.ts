import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { setupTestPostgres, teardownTestPostgres, testDb } from '../../_setup/test-postgres';
import { runWalletReconciliation } from '../../../src/server/workers/jobs/wallet-reconciliation.job';

describe('Wallet Reconciliation Job', () => {
  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
    await setupTestPostgres();
  });

  afterAll(async () => {
    await teardownTestPostgres();
  });

  beforeEach(async () => {
    await testDb.walletLedger.deleteMany();
    await testDb.wallet.deleteMany();
    await testDb.rider.deleteMany();
  });

  it('should verify all wallets and return healthy when no drift', async () => {
    const riderId1 = uuidv4();
    await testDb.rider.create({ data: { id: riderId1, riderId: uuidv4(), referralCode: uuidv4().slice(0, 8), phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}` } });
    const wallet1 = await testDb.wallet.create({ data: { riderId: riderId1, balanceInPaise: 5000 } });
    await testDb.walletLedger.create({
      data: { walletId: wallet1.id, riderId: riderId1, entryType: 'CREDIT', amountInPaise: 5000, category: 'TOP_UP', balanceAfter: 5000 }
    });

    const result = await runWalletReconciliation();
    // Verify this test's wallet specifically is healthy.
    // Other test files may have left wallets in the shared test DB, so we
    // only assert on the totalDrift (0) and that our wallet is accounted for.
    const ourWallet = result.driftedRiders.find((r) => r.riderId === riderId1);
    expect(ourWallet).toBeUndefined(); // Our wallet is healthy (not in drifted list)
    expect(result.totalDrift).toBe(0);
  });

  it('should detect drift when wallet balance does not match ledger', async () => {
    const riderId = uuidv4();
    await testDb.rider.create({ data: { id: riderId, riderId: uuidv4(), referralCode: uuidv4().slice(0, 8), phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}` } });
    // Wallet has 1000, but ledger only has 500
    const wallet = await testDb.wallet.create({ data: { riderId: riderId, balanceInPaise: 1000 } });
    await testDb.walletLedger.create({
      data: { walletId: wallet.id, riderId: riderId, entryType: 'CREDIT', amountInPaise: 500, category: 'TOP_UP', balanceAfter: 500 }
    });

    const result = await runWalletReconciliation();
    // Verify this test's wallet specifically is in the drifted list with the
    // correct drift amount. Other test files may have left wallets in the
    // shared test DB, so we only assert on our specific wallet.
    const ourWallet = result.driftedRiders.find((r) => r.riderId === riderId);
    expect(ourWallet).toBeDefined();
    expect(ourWallet?.drift).toBe(500);
    expect(result.totalDrift).toBeGreaterThanOrEqual(500);
  });
});
