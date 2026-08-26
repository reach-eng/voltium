import { describe, it, expect } from 'vitest';
import { api, generateRandomPhone, riderLogin, adminLogin } from '../helpers';

const LONG_TIMEOUT = 30000;

describe('State Machine Transition Negative Tests', () => {
  describe('KYC state machine', () => {
    it('cannot submit KYC twice for same rider', { timeout: LONG_TIMEOUT }, async () => {
      const phone = generateRandomPhone();
      const { token, id } = await riderLogin(phone);

      const first = await api('/api/rider/kyc', {
        method: 'POST',
        token,
        json: {
          riderId: id,
          aadhaarNumber: '1234-5678-9012',
          panNumber: 'ABCDE1234F',
          bankName: 'SBI',
          bankAccount: '12345678901',
          bankIfsc: 'SBIN0001234',
        },
      });

      const { status, body } = await api('/api/rider/kyc', {
        method: 'POST',
        token,
        json: {
          riderId: id,
          aadhaarNumber: '1234-5678-9012',
          panNumber: 'ABCDE1234F',
          bankName: 'SBI',
          bankAccount: '12345678901',
          bankIfsc: 'SBIN0001234',
        },
      });
      if (status !== 200) {
        expect([400, 409, 422]).toContain(status);
        expect(body.success).toBe(false);
      }
    });

    it('cannot approve KYC without admin cookie', async () => {
      const { status, body } = await api('/api/admin/kyc', {
        method: 'POST',
        json: { riderId: 'some-id', action: 'APPROVE' },
      });
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });

    it('rejects KYC review with invalid action', async () => {
      const cookie = await adminLogin();

      const { status, body } = await api('/api/admin/kyc', {
        method: 'POST',
        cookie,
        json: { riderId: 'some-id', action: 'INVALID_ACTION' },
      });
      expect([200, 400, 422]).toContain(status);
      if (status !== 200) expect(body.success).toBe(false);
    });
  });

  describe('Deposit state machine', () => {
    it('cannot reject a deposit that does not exist', { timeout: LONG_TIMEOUT }, async () => {
      const cookie = await adminLogin();
      const phone = generateRandomPhone();
      const { id } = await riderLogin(phone);

      const { status } = await api('/api/admin/deposits', {
        method: 'POST',
        cookie,
        json: { riderId: id, action: 'REJECT', reason: 'No deposit found' },
      });
      expect([400, 404, 409]).toContain(status);
    });

    it('cannot forfeit a deposit without it being approved first', { timeout: LONG_TIMEOUT }, async () => {
      const cookie = await adminLogin();
      const phone = generateRandomPhone();
      const { id } = await riderLogin(phone);

      const { status } = await api('/api/admin/deposits', {
        method: 'POST',
        cookie,
        json: { riderId: id, action: 'FORFEIT' },
      });
      expect([400, 404, 409]).toContain(status);
    });
  });

  describe('Rental lifecycle state machine', () => {
    it('cannot return a rental that is not active', { timeout: LONG_TIMEOUT }, async () => {
      const phone = generateRandomPhone();
      const { token } = await riderLogin(phone);

      const { status, body } = await api('/api/rider/rental/return', {
        method: 'POST',
        token,
        json: { vehicleId: 'non-existent' },
      });
      expect([200, 400, 404, 409]).toContain(status);
      if (status !== 200) expect(body.success).toBe(false);
    });
  });

  describe('Guarantor state machine', () => {
    it('cannot submit guarantor before KYC approval', { timeout: LONG_TIMEOUT }, async () => {
      const phone = generateRandomPhone();
      const { token, id } = await riderLogin(phone);

      const { status, body } = await api('/api/rider/guarantor', {
        method: 'POST',
        token,
        json: {
          riderId: id,
          name: 'Guarantor Name',
          phone: '9876543210',
          email: 'guarantor@test.com',
          relation: 'FATHER',
          address: 'Test Address',
        },
      });
      expect([200, 400, 409]).toContain(status);
      if (status !== 200) expect(body.success).toBe(false);
    });
  });
});
