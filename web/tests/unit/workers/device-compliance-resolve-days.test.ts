/**
 * P2-4 (PR-A, 2026-08-28 workflows polish): the device-compliance job's
 * 7-day auto-resolve window is admin-configurable via the
 * `deviceViolationAutoResolveDays` system setting. Default 7 if the
 * setting is missing.
 *
 * Two tests:
 *  - default: no setting row → window is 7 days
 *  - override: setting row with value "3" → window is 3 days
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from '../../_setup/test-postgres';
import { clock } from '../../../src/lib/clock';
import { deviceComplianceJob } from '../../../src/server/workers/jobs/device-compliance.job';
import { v4 as uuidv4 } from 'uuid';

const SETTING_KEY = 'deviceViolationAutoResolveDays';

async function seedRiderWithViolation(violationAgeDays: number) {
  const riderId = uuidv4();
  await testDb.rider.create({
    data: {
      id: riderId,
      riderId: uuidv4(),
      referralCode: uuidv4().slice(0, 8),
      phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      lifecycleStatus: 'ACTIVE',
      isLocationMandatory: false, // no new violations
    },
  });
  const reportedAt = new Date(clock.now().getTime() - violationAgeDays * 24 * 60 * 60 * 1000);
  await testDb.deviceViolation.create({
    data: { riderId, permissionId: 'location', status: 'ACTIVE', reportedAt },
  });
  return riderId;
}

describe('Device Compliance auto-resolve window (P2-4)', () => {
  beforeEach(async () => {
    await testDb.outboxEvent.deleteMany();
    await testDb.deviceViolation.deleteMany();
    await testDb.rider.deleteMany();
    await testDb.systemSetting.deleteMany({ where: { key: SETTING_KEY } });
    clock.reset();
  });

  it('default 7 days when no setting exists', async () => {
    const riderId = await seedRiderWithViolation(8); // 8 days old

    await deviceComplianceJob.process({ id: 'test' });

    const v = await testDb.deviceViolation.findFirst({ where: { riderId } });
    expect(v?.status).toBe('RESOLVED'); // 8 > 7 → resolved
  });

  it('keeps a 3-day-old violation ACTIVE under default 7', async () => {
    const riderId = await seedRiderWithViolation(3);

    await deviceComplianceJob.process({ id: 'test' });

    const v = await testDb.deviceViolation.findFirst({ where: { riderId } });
    expect(v?.status).toBe('ACTIVE'); // 3 < 7 → still active
  });

  it('honors the system setting (override to 3 days)', async () => {
    await testDb.systemSetting.create({
      data: { key: SETTING_KEY, value: '3', category: 'DEVICE_COMPLIANCE' },
    });
    const riderId = await seedRiderWithViolation(5); // 5 days old, but override is 3

    await deviceComplianceJob.process({ id: 'test' });

    const v = await testDb.deviceViolation.findFirst({ where: { riderId } });
    expect(v?.status).toBe('RESOLVED'); // 5 > 3 (override) → resolved
  });

  it('falls back to 7 if setting value is unparseable', async () => {
    await testDb.systemSetting.create({
      data: { key: SETTING_KEY, value: 'not-a-number', category: 'DEVICE_COMPLIANCE' },
    });
    const riderId = await seedRiderWithViolation(8); // 8 > 7 default

    await deviceComplianceJob.process({ id: 'test' });

    const v = await testDb.deviceViolation.findFirst({ where: { riderId } });
    expect(v?.status).toBe('RESOLVED');
  });
});
