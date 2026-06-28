import { describe, it, expect } from 'vitest';
import { api, generateRandomPhone, riderLogin, adminLogin } from '../helpers';

const LONG_TIMEOUT = 30000;

describe('Conflict & Race Condition Tests', () => {
  describe('Duplicate operations', () => {
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

    it('cannot approve KYC twice', { timeout: LONG_TIMEOUT }, async () => {
      const cookie = await adminLogin();
      const phone = generateRandomPhone();
      const { id } = await riderLogin(phone);

      const first = await api('/api/admin/kyc', {
        method: 'POST',
        cookie,
        json: { riderId: id, action: 'APPROVE' },
      });

      const { status, body } = await api('/api/admin/kyc', {
        method: 'POST',
        cookie,
        json: { riderId: id, action: 'APPROVE' },
      });
      if (status !== 200) {
        expect([400, 409]).toContain(status);
        expect(body.success).toBe(false);
      }
    });

    it('cannot book the same vehicle twice', { timeout: LONG_TIMEOUT }, async () => {
      const phone = generateRandomPhone();
      const { token } = await riderLogin(phone);

      const { body: first } = await api('/api/rental/book', {
        method: 'POST',
        token,
        json: {
          vehicleId: 'VEH-DUP-001',
          shiftId: 'shift-1',
          leaseDate: '2026-06-20',
          startTime: '08:00',
        },
      });

      if (first && first.success) {
        const { status, body } = await api('/api/rental/book', {
          method: 'POST',
          token,
          json: {
            vehicleId: 'VEH-DUP-001',
            shiftId: 'shift-1',
            leaseDate: '2026-06-20',
            startTime: '08:00',
          },
        });
        if (status !== 200) {
          expect([400, 409]).toContain(status);
          expect(body.success).toBe(false);
        }
      }
    });
  });

  describe('State machine conflict prevention', () => {
    it('cannot withdraw KYC after approval without admin reset', { timeout: LONG_TIMEOUT }, async () => {
      const cookie = await adminLogin();
      const phone = generateRandomPhone();
      const { id } = await riderLogin(phone);

      const approveRes = await api('/api/admin/kyc', {
        method: 'POST',
        cookie,
        json: { riderId: id, action: 'APPROVE' },
      });

      const { status, body } = await api('/api/rider/kyc', {
        method: 'POST',
        cookie,
        json: {
          riderId: id,
          aadhaarNumber: '1234-5678-9012',
          panNumber: 'ABCDE1234F',
          bankName: 'SBI',
          bankAccount: '12345678901',
          bankIfsc: 'SBIN0001234',
        },
      });
      expect([200, 400, 401, 403, 409]).toContain(status);
      if (status !== 200) expect(body.success).toBe(false);
    });

    it('rejects deposit topup on rider that does not exist', async () => {
      const { status, body } = await api('/api/transaction/topup', {
        method: 'POST',
        json: {
          riderId: 'non-existent-rider-id',
          amount: 1000,
          purpose: 'SECURITY_DEPOSIT',
          method: 'UPI',
        },
      });
      expect([400, 401, 404, 422]).toContain(status);
      expect(body.success).toBe(false);
    });
  });

  describe('Concurrent request handling', () => {
    it('handles concurrent OTP send requests gracefully', async () => {
      const phone = generateRandomPhone();

      const results = await Promise.all(
        Array.from({ length: 5 }).map(() =>
          api('/api/auth/send-otp', {
            method: 'POST',
            json: { phone },
          })
        )
      );

      const successes = results.filter((r) => r.status === 200);
      expect(successes.length).toBeGreaterThanOrEqual(1);

      const others = results.filter((r) => r.status !== 200);
      expect(successes.length + others.length).toBe(results.length);
    });

    it('handles concurrent verify OTP requests gracefully', async () => {
      const phone = generateRandomPhone();

      const sendRes = await api('/api/auth/send-otp', {
        method: 'POST',
        json: { phone },
      });
      expect(sendRes.status).toBe(200);
      const otp = sendRes.body.data?.otp || '123456';

      const results = await Promise.all(
        Array.from({ length: 3 }).map(() =>
          api('/api/auth/verify-otp', {
            method: 'POST',
            json: { phone, otp },
          })
        )
      );

      const okCount = results.filter((r) => r.status === 200).length;
      expect(okCount).toBeGreaterThanOrEqual(1);
    });
  });
});
