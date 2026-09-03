import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { rentRemindersJob } from '../../../src/server/workers/jobs/rent-reminders.job';
import { clock } from '../../../src/lib/clock';

vi.mock('../../../src/lib/notification-service', () => ({
  notificationService: {
    notifyPaymentReminder: vi.fn().mockResolvedValue(true)
  }
}));

describe('Rent Reminders Job', () => {
  beforeAll(async () => {
  });

  afterAll(async () => {
  });

  beforeEach(async () => {
    // Use TRUNCATE ... CASCADE to reset the test schema between
    // tests. The original Prisma `deleteMany` chain hit FK
    // Restrict constraints (Vehicle.hubId, etc.) that we can't
    // clean up reliably without knowing the full child graph.
    await testDb.$executeRawUnsafe(`
      TRUNCATE TABLE
        "outbox_events",
        "wallet_ledgers",
        "transactions",
        "rental_leases",
        "wallets",
        "riders",
        "vehicles",
        "rental_plans",
        "shifts",
        "hubs"
      RESTART IDENTITY CASCADE
    `);
    clock.reset();
  });

  async function setupEntities() {
    const riderId = uuidv4();
    const hubId = uuidv4();
    const planId = uuidv4();
    const vehicleId = uuidv4();

    await testDb.hub.create({
      data: {
        id: hubId,
        name: `Test Hub ${uuidv4()}`,
        isActive: true,
        location: '0101000020E610000000000000000000000000000000000000'
      }
    });

    const shift = await testDb.shift.create({
      data: {
        id: uuidv4(),
        name: `Morning ${uuidv4().slice(0, 8)}`,
        startTime: '10:00',
        endTime: '18:00',
      }
    });
    const shiftId = shift.id;

    await testDb.rentalPlan.create({
      data: {
        id: planId,
        name: `Test Plan ${uuidv4().slice(0, 8)}`,
        priceInPaise: 5000,
        type: 'MONTHLY',
        durationDays: 30,
        isActive: true,
      }
    });

    await testDb.vehicle.create({
      data: {
        id: vehicleId,
        vehicleId: uuidv4().slice(0, 10),
        vehicleNumber: `TEST-${uuidv4().slice(0, 8)}`,
        model: 'TestModel',
        hubId,
        status: 'AVAILABLE'
      }
    });

    await testDb.rider.create({
      data: {
        id: riderId,
        riderId: uuidv4(),
        referralCode: uuidv4().slice(0, 8),
        phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        lifecycleStatus: 'ACTIVE',
        // PR-76: link the rider to the plan so the rent-reminders
        // job can read `durationDays` to advance `nextRentDueAt`.
        currentPlanId: planId,
      }
    });

    const wallet = await testDb.wallet.create({
      data: { riderId, balanceInPaise: 0 }
    });

    return { riderId, wallet, planId, vehicleId, hubId, shiftId };
  }

  it('should auto-debit if balance is sufficient', async () => {
    const { riderId, wallet, vehicleId, shiftId } = await setupEntities();

    await testDb.wallet.update({
      where: { id: wallet.id },
      data: { balanceInPaise: 6000 }
    });

    await testDb.rentalLease.create({
      data: {
        id: uuidv4(),
        riderId,
        shiftId,
        vehicleId,
        status: 'BOOKED',
        leaseDate: clock.now().toISOString().split('T')[0],
        basePriceInPaise: 5000,
        finalPriceInPaise: 5000,
        startTime: '10:00',
        // PR-76: new period-tracking fields. nextRentDueAt is
        // required by the rent-reminders filter.
        nextRentDueAt: clock.now(),
        periodNo: 0,
      }
    });

    const result = await rentRemindersJob.process({ id: 'test' });
    expect(result.checkedRentals).toBe(1);
    expect(result.autoDebited).toBe(1);
    expect(result.overdueDetected).toBe(0);

    const updatedWallet = await testDb.wallet.findUnique({ where: { id: wallet.id } });
    expect(updatedWallet?.balanceInPaise).toBe(1000);

    const txn = await testDb.transaction.findFirst({ where: { riderId } });
    expect(txn?.amountInPaise).toBe(5000);
    expect(txn?.purpose).toBe('RENT_PAYMENT');
  });

  it('should mark overdue and emit outbox event if balance insufficient', async () => {
    const { riderId, wallet, vehicleId, shiftId } = await setupEntities();

    await testDb.wallet.update({
      where: { id: wallet.id },
      data: { balanceInPaise: 1000 } // insufficient for 5000 rent
    });

    await testDb.rentalLease.create({
      data: {
        id: uuidv4(),
        riderId,
        shiftId,
        vehicleId,
        status: 'BOOKED',
        leaseDate: clock.now().toISOString().split('T')[0],
        basePriceInPaise: 5000,
        finalPriceInPaise: 5000,
        startTime: '10:00',
        nextRentDueAt: clock.now(),
        periodNo: 0,
      }
    });

    const result = await rentRemindersJob.process({ id: 'test' });
    expect(result.checkedRentals).toBe(1);
    expect(result.autoDebited).toBe(0);
    expect(result.overdueDetected).toBe(1);

    const updatedWallet = await testDb.wallet.findUnique({ where: { id: wallet.id } });
    expect(updatedWallet?.balanceInPaise).toBe(1000); // untouched

    const outbox = await testDb.outboxEvent.findFirst({ where: { eventType: 'rent.overdue' } });
    expect(outbox).toBeDefined();
    expect(outbox).not.toBeNull();
    const payloadObj = JSON.parse(outbox!.payload);
    expect(payloadObj.amountDue).toBe(5000);
  });

  // PR-76 regression: a 7-day tenant must be debited exactly once
  // across 7 day-ticks, not 7 times. The previous code keyed on
  // `rent:{lease.id}:{today}` so each day was a fresh key.
  it('PR-76: a 7-day tenant is debited once, not 7 times across 7 day-ticks', async () => {
    const { riderId, wallet, vehicleId, shiftId, planId } = await setupEntities();

    // Re-set the plan to 7 days
    await testDb.rentalPlan.update({
      where: { id: planId },
      data: { type: 'WEEKLY', durationDays: 7, priceInPaise: 1000_00 },
    });

    await testDb.wallet.update({
      where: { id: wallet.id },
      data: { balanceInPaise: 7_000_00 } // 7 × ₹1000 = enough for 7 periods
    });

    const lease = await testDb.rentalLease.create({
      data: {
        id: uuidv4(),
        riderId,
        shiftId,
        vehicleId,
        status: 'BOOKED',
        leaseDate: clock.now().toISOString().split('T')[0],
        basePriceInPaise: 1000_00, // ₹1000
        finalPriceInPaise: 1000_00,
        startTime: '10:00',
        nextRentDueAt: clock.now(),
        periodNo: 0,
      }
    });

    // Simulate 7 day-ticks (one period per tick)
    let totalAutoDebited = 0;
    const c = clock.start();
    // First tick at offset 0 (lease is due now), then advance 1d per tick.
    // After 7 iterations, offset = 7d, but we only advance AFTER process
    // so the last process() call has offset = 6d. That keeps the
    // final assertion `nextRentDueAt (T0+7d) > clockNow (T0+6d)` true.
    for (let day = 0; day < 6; day++) {
      const result = await rentRemindersJob.process({ id: `day-${day}` });
      totalAutoDebited += result.autoDebited;
      c.advance(24 * 60 * 60 * 1000);
    }
    // One more tick at offset 6d (no advance) — this verifies
    // that the lease is NOT picked up because nextRentDueAt is at T0+7d.
    const lastResult = await rentRemindersJob.process({ id: 'day-6' });
    expect(lastResult.autoDebited).toBe(0);
    totalAutoDebited += lastResult.autoDebited;

    // CRITICAL: a 7-day tenant with 1-period pricing must be debited
    // exactly once (period 0 → period 1 with nextRentDueAt bumped
    // 7 days into the future). The pre-PR-76 code debited 7 times
    // because the key was per-day, not per-period.
    expect(totalAutoDebited).toBe(1);

    // Wallet should show only 1 debit worth gone (₹1000), because
    // nextRentDueAt is now 7 days in the future.
    const updatedWallet = await testDb.wallet.findUnique({ where: { id: wallet.id } });
    expect(updatedWallet?.balanceInPaise).toBe(7_000_00 - 1000_00); // ₹6000

    // Lease period advanced to 1
    const updatedLease = await testDb.rentalLease.findUnique({ where: { id: lease.id } });
    expect(updatedLease?.periodNo).toBe(1);
    expect(updatedLease?.lastPaidAt).toBeDefined();
    // PR-76: after 6 day-ticks, nextRentDueAt (T0+7d) must be in the
    // future of clock.now() (T0+6d). The 7-day tenant is debited
    // exactly once, and the next period is 1 day away.
    expect(updatedLease?.nextRentDueAt!.getTime()).toBeGreaterThan(clock.now().getTime());
  });

  it('PR-76: idempotency key includes period, not date', async () => {
    const { riderId, wallet, vehicleId, shiftId } = await setupEntities();

    await testDb.wallet.update({
      where: { id: wallet.id },
      data: { balanceInPaise: 50_000 }
    });

    await testDb.rentalLease.create({
      data: {
        id: uuidv4(),
        riderId,
        shiftId,
        vehicleId,
        status: 'BOOKED',
        leaseDate: clock.now().toISOString().split('T')[0],
        basePriceInPaise: 5000,
        finalPriceInPaise: 5000,
        startTime: '10:00',
        nextRentDueAt: clock.now(),
        periodNo: 0,
      }
    });

    await rentRemindersJob.process({ id: 'first' });

    // After the first debit, periodNo is 1, nextRentDueAt is in the
    // future. A second process call should NOT re-debit because
    // the lease doesn't match the filter (`nextRentDueAt > now()`).
    const result = await rentRemindersJob.process({ id: 'second' });
    expect(result.autoDebited).toBe(0);
    expect(result.checkedRentals).toBe(0);

    // The transaction's idempotency key should be `rent:{leaseId}:period:0`,
    // NOT `rent:{leaseId}:{date}`.
    const txn = await testDb.transaction.findFirst({ where: { riderId } });
    expect(txn?.idempotencyKey).toMatch(/^rent:.+:period:0$/);
  });

  it('F-04: should auto-debit active leases with status ACTIVE', async () => {
    const { riderId, wallet, vehicleId, shiftId } = await setupEntities();

    await testDb.wallet.update({
      where: { id: wallet.id },
      data: { balanceInPaise: 10000 }
    });

    const leaseId = uuidv4();
    await testDb.rentalLease.create({
      data: {
        id: leaseId,
        riderId,
        shiftId,
        vehicleId,
        status: 'ACTIVE',
        leaseDate: clock.now().toISOString().split('T')[0],
        basePriceInPaise: 5000,
        finalPriceInPaise: 5000,
        startTime: '10:00',
        nextRentDueAt: clock.now(),
        periodNo: 1,
      }
    });

    const result = await rentRemindersJob.process({ id: 'active-test' });
    expect(result.checkedRentals).toBe(1);
    expect(result.autoDebited).toBe(1);
    expect(result.overdueDetected).toBe(0);

    const updatedWallet = await testDb.wallet.findUnique({ where: { id: wallet.id } });
    expect(updatedWallet?.balanceInPaise).toBe(5000);

    const updatedLease = await testDb.rentalLease.findUnique({ where: { id: leaseId } });
    expect(updatedLease?.periodNo).toBe(2);
    expect(updatedLease?.status).toBe('ACTIVE');

    const txn = await testDb.transaction.findFirst({ where: { riderId } });
    expect(txn?.amountInPaise).toBe(5000);
    expect(txn?.purpose).toBe('RENT_PAYMENT');
  });
});
