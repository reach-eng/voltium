/**
 * PR-101 (B-A1) — MRR filter on RENT_PAYMENT debits (regression test).
 *
 * The dashboard MRR was previously inflated because the SUM aggregated
 * ALL APPROVED transactions (deposits, reversals, sign-up bonuses, admin
 * adjustments). PR-79 fixed this by adding `type = 'DEBIT'` and
 * `purpose = 'RENT_PAYMENT'` filters to the SUM.
 *
 * This test is a regression guard: it seeds a representative mix of
 * APPROVED transactions across the 4 (type, purpose) combinations that
 * could otherwise be mis-aggregated, then calls
 * `analyticsUseCases.getOverview()` and asserts that the returned
 * `currentMRR` includes ONLY RENT_PAYMENT / DEBIT rows.
 *
 * Plan: docs/AUDIT_PHASE7_PLAN_2026-08-04.md PR-101
 *      (verifies the live tree at analytics.use-cases.ts:97-110)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { clock } from '../../../src/lib/clock';
import { analyticsUseCases } from '../../../src/server/modules/analytics/analytics.use-cases';

const PAISE = (rupees: number) => rupees * 100;

describe('PR-101: analytics MRR — RENT_PAYMENT debit filter', () => {
  beforeEach(async () => {
    // Reset the tables the analytics query touches. The full TRUNCATE
    // mirrors the pattern in workers/referral-reward.job.test.ts so
    // cross-test runs are deterministic.
    await testDb.$executeRawUnsafe(`
      TRUNCATE TABLE
        "transactions",
        "wallets",
        "riders"
      RESTART IDENTITY CASCADE
    `);
    clock.reset();
  });

  it('PR-79/101: only RENT_PAYMENT DEBIT transactions count toward currentMRR', async () => {
    // A rider is required so the transactions have a valid FK target.
    const riderId = uuidv4();
    const riderRowId = `V${Math.floor(Math.random() * 1_000_000_000)}`;
    await testDb.rider.create({
      data: {
        id: riderId,
        riderId: riderRowId,
        phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        referralCode: uuidv4().slice(0, 8),
        lifecycleStatus: 'ACTIVE',
      },
    });

    // Four transaction types, all APPROVED in the current month.
    // Only the first should contribute to MRR.
    const now = new Date();
    const rows = [
      { type: 'DEBIT', purpose: 'RENT_PAYMENT', amountInPaise: PAISE(1000) }, // counts
      { type: 'CREDIT', purpose: 'RENT_PAYMENT', amountInPaise: PAISE(9999) }, // wrong-sign, must NOT
      { type: 'DEBIT', purpose: 'SECURITY_DEPOSIT', amountInPaise: PAISE(9998) }, // wrong-purpose, must NOT
      { type: 'DEBIT', purpose: 'TOP_UP', amountInPaise: PAISE(9997) }, // wrong-purpose, must NOT
    ] as const;

    for (const r of rows) {
      await testDb.transaction.create({
        data: {
          riderId,
          type: r.type,
          purpose: r.purpose,
          amountInPaise: r.amountInPaise,
          status: 'APPROVED',
          createdAt: now,
          approvedAt: now,
        },
      });
    }

    const result = await analyticsUseCases.getOverview();

    // Only the RENT_PAYMENT / DEBIT row (₹1000) should be counted.
    expect(result.overview.currentMRR).toBe(1000);
  });

  it('PR-101: pending/REJECTED transactions are excluded from MRR', async () => {
    const riderId = uuidv4();
    const riderRowId = `V${Math.floor(Math.random() * 1_000_000_000)}`;
    await testDb.rider.create({
      data: {
        id: riderId,
        riderId: riderRowId,
        phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        referralCode: uuidv4().slice(0, 8),
        lifecycleStatus: 'ACTIVE',
      },
    });

    const now = new Date();
    // Same purpose/type, but PENDING and REJECTED — must NOT be summed.
    await testDb.transaction.create({
      data: {
        riderId,
        type: 'DEBIT',
        purpose: 'RENT_PAYMENT',
        amountInPaise: PAISE(500),
        status: 'PENDING',
        createdAt: now,
      },
    });
    await testDb.transaction.create({
      data: {
        riderId,
        type: 'DEBIT',
        purpose: 'RENT_PAYMENT',
        amountInPaise: PAISE(700),
        status: 'REJECTED',
        createdAt: now,
      },
    });
    // A single APPROVED RENT_PAYMENT DEBIT to anchor the math.
    await testDb.transaction.create({
      data: {
        riderId,
        type: 'DEBIT',
        purpose: 'RENT_PAYMENT',
        amountInPaise: PAISE(333),
        status: 'APPROVED',
        createdAt: now,
        approvedAt: now,
      },
    });

    const result = await analyticsUseCases.getOverview();
    expect(result.overview.currentMRR).toBe(333);
  });
});
