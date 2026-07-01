import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { testDb } from '../../_setup/test-postgres';
import { clock } from '../../../src/lib/clock';
import { deviceComplianceJob } from '../../../src/server/workers/jobs/device-compliance.job';
import { v4 as uuidv4 } from 'uuid';

describe('Device Compliance Job', () => {
  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
  });

  afterAll(async () => {
  });

  beforeEach(async () => {
    await testDb.outboxEvent.deleteMany();
    await testDb.deviceViolation.deleteMany();
    await testDb.rider.deleteMany();
    clock.reset();
  });

  it('should detect new violations and resolve old ones', async () => {
    const riderId1 = uuidv4();
    await testDb.rider.create({ 
      data: { id: riderId1, riderId: uuidv4(), referralCode: uuidv4().slice(0, 8), phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`, lifecycleStatus: 'ACTIVE', isLocationMandatory: true, deviceViolationCount: 1 } 
    });
    
    const riderId2 = uuidv4();
    await testDb.rider.create({ 
      data: { id: riderId2, riderId: uuidv4(), referralCode: uuidv4().slice(0, 8), phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`, lifecycleStatus: 'ACTIVE', isLocationMandatory: true, deviceViolationCount: 0 } 
    });

    const oldDate = new Date(clock.now().getTime() - 8 * 24 * 60 * 60 * 1000);
    await testDb.deviceViolation.create({
      data: { riderId: riderId2, permissionId: 'location', status: 'ACTIVE', reportedAt: oldDate }
    });

    const result = await deviceComplianceJob.process({ id: 'test' });
    
    expect(result.ridersChecked).toBe(2);
    expect(result.violationsFound).toBe(1); // Rider 1 gets a new violation
    expect(result.violationsResolved).toBe(1); // Rider 2's old violation is resolved

    const activeViolation = await testDb.deviceViolation.findFirst({ where: { riderId: riderId1 } });
    expect(activeViolation?.status).toBe('ACTIVE');

    const resolvedViolation = await testDb.deviceViolation.findFirst({ where: { riderId: riderId2 } });
    expect(resolvedViolation?.status).toBe('RESOLVED');

    const outbox = await testDb.outboxEvent.findFirst({ where: { eventType: 'device.violation' } });
    expect(outbox).toBeDefined();
    
    const payload = typeof outbox?.payload === 'string' ? JSON.parse(outbox.payload) : outbox?.payload;
    expect((payload as any).riderId).toBe(riderId1);
  });
});
