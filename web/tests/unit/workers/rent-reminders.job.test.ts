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
    process.env.DATABASE_OFFLINE = 'false';
  });

  afterAll(async () => {
  });

  beforeEach(async () => {
    await testDb.outboxEvent.deleteMany();
    await testDb.walletLedger.deleteMany();
    await testDb.transaction.deleteMany();
    await testDb.rentalLease.deleteMany();

    await testDb.wallet.deleteMany();
    await testDb.rider.deleteMany();
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
        price: 5000,
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
      data: { id: riderId, riderId: uuidv4(), referralCode: uuidv4().slice(0, 8), phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`, lifecycleStatus: 'ACTIVE' }
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
        basePrice: 5000,
        finalPrice: 5000,
        startTime: '10:00',
      }
    });

    const result = await rentRemindersJob.process({ id: 'test' });
    expect(result.checkedRentals).toBe(1);
    expect(result.autoDebited).toBe(1);
    expect(result.overdueDetected).toBe(0);

    const updatedWallet = await testDb.wallet.findUnique({ where: { id: wallet.id } });
    expect(updatedWallet?.balanceInPaise).toBe(1000);

    const txn = await testDb.transaction.findFirst({ where: { riderId } });
    expect(txn?.amount).toBe(5000);
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
        basePrice: 5000,
        finalPrice: 5000,
        startTime: '10:00',
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
});
