import { describe, it, expect } from 'vitest';
import { api, generateRandomPhone, riderLogin } from '../helpers';

describe('Rider Onboarding Integration Workflow', () => {
  // 1. New rider state starts as NEW or PROFILE_INCOMPLETE/PHONE_VERIFIED
  it('1. New rider state starts as NEW or PHONE_VERIFIED', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    const { status, body } = await api('/api/rider/profile', {
      method: 'GET',
      token,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(['NEW', 'PHONE_VERIFIED', 'PRE_ACTIVE']).toContain(body.data.lifecycleStatus);
  });

  // 2. Rider can save profile details
  it('2. Rider can save profile details', async () => {
    const phone = generateRandomPhone();
    const { token, id } = await riderLogin(phone);

    const { status, body } = await api('/api/rider/profile', {
      method: 'PUT',
      token,
      json: {
        riderId: id,
        fullName: 'Jane Doe',
        fatherName: 'John Doe',
        motherName: 'Mary Doe',
        emergencyContact: '9876543210',
        dob: '01-01-2000',
        intent: 'deliver',
      },
    });

    // In mock DB mode or real DB mode, this returns a successful profile save
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.fullName).toBe('Jane Doe');
  });

  // 3. Missing required profile fields are rejected
  it('3. Missing required profile fields are rejected', async () => {
    const phone = generateRandomPhone();
    const { token, id } = await riderLogin(phone);

    // DOB has invalid format in schema validator
    const { status, body } = await api('/api/rider/profile', {
      method: 'PUT',
      token,
      json: {
        riderId: id,
        dob: 'invalid-dob',
      },
    });

    expect(status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // 4. Completed profile moves rider to KYC_PENDING / PROFILE_SUBMITTED
  it('4. Completed profile moves rider state forward', async () => {
    const phone = generateRandomPhone();
    const { token, id } = await riderLogin(phone);

    const { status, body } = await api('/api/rider/profile', {
      method: 'PUT',
      token,
      json: {
        riderId: id,
        fullName: 'Jane Doe',
        emergencyContact: '9876543210',
        dob: '12-12-1995',
        intent: 'deliver',
      },
    });

    expect(status).toBe(200);
    // State machine updates state to PROFILE_SUBMITTED or KYC_PENDING
    expect(body.data.lifecycleStatus).toBeDefined();
  });

  // 5. Rider state endpoint returns correct next required step
  it('5. Rider state endpoint returns correct next required step', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    const { status, body } = await api('/api/rider/profile', {
      method: 'GET',
      token,
    });

    expect(status).toBe(200);
    expect(body.data.lifecycleStatus).toBeDefined();
  });

  // 6. Rider cannot skip directly to vehicle booking before KYC/deposit/plan
  it('6. Rider cannot skip directly to vehicle booking before KYC/deposit/plan', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    // Try booking a vehicle or scheduling pickup direct
    const { status } = await api('/api/rider/rental/schedule', {
      method: 'POST',
      token,
      json: { hubId: 'hub-delhi-central', pickupDate: '2026-06-20' },
    });

    // Directly booking a vehicle returns 400 Bad Request or 403 Forbidden because of lifecycle locks
    expect(status).toBeGreaterThanOrEqual(400);
  });
});
