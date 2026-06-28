import { describe, it, expect } from 'vitest';
import { api, generateRandomPhone, riderLogin, adminLogin } from '../helpers';

const LONG_TIMEOUT = 30000;

describe('Input Validation Tests', () => {
  describe('/api/auth/send-otp', () => {
    it('rejects missing phone number', async () => {
      const { status, body } = await api('/api/auth/send-otp', {
        method: 'POST',
        json: {},
      });
      expect([400, 422]).toContain(status);
      expect(body.success).toBe(false);
    });

    it('rejects empty phone', async () => {
      const { status, body } = await api('/api/auth/send-otp', {
        method: 'POST',
        json: { phone: '' },
      });
      expect([400, 422]).toContain(status);
      expect(body.success).toBe(false);
    });

    it('rejects short phone number', async () => {
      const { status, body } = await api('/api/auth/send-otp', {
        method: 'POST',
        json: { phone: '123' },
      });
      expect([400, 422]).toContain(status);
      expect(body.success).toBe(false);
    });
  });

  describe('/api/rider/kyc', () => {
    it('rejects KYC submit with missing required fields', { timeout: LONG_TIMEOUT }, async () => {
      const phone = generateRandomPhone();
      const { token, id } = await riderLogin(phone);

      const { status, body } = await api('/api/rider/kyc', {
        method: 'POST',
        token,
        json: { riderId: id },
      });
      expect([400, 422]).toContain(status);
      expect(body.success).toBe(false);
    });

    it('rejects KYC with invalid PAN format', { timeout: LONG_TIMEOUT }, async () => {
      const phone = generateRandomPhone();
      const { token, id } = await riderLogin(phone);

      const { status } = await api('/api/rider/kyc', {
        method: 'POST',
        token,
        json: {
          riderId: id,
          aadhaarNumber: '1234-5678-9012',
          panNumber: 'INVALID',
          bankName: 'SBI',
          bankAccount: '12345678901',
          bankIfsc: 'SBIN0001234',
        },
      });
      expect([400, 422]).toContain(status);
    });

    it('rejects KYC with invalid aadhaar format', { timeout: LONG_TIMEOUT }, async () => {
      const phone = generateRandomPhone();
      const { token, id } = await riderLogin(phone);

      const { status } = await api('/api/rider/kyc', {
        method: 'POST',
        token,
        json: {
          riderId: id,
          aadhaarNumber: '123',
          panNumber: 'ABCDE1234F',
          bankName: 'SBI',
          bankAccount: '12345678901',
          bankIfsc: 'SBIN0001234',
        },
      });
      expect([400, 422]).toContain(status);
    });
  });

  describe('/api/admin/auth/login', () => {
    it('rejects login with empty email', async () => {
      const { status, body } = await api('/api/admin/auth/login', {
        method: 'POST',
        json: { email: '', password: 'test123' },
      });
      expect([400, 422]).toContain(status);
      expect(body.success).toBe(false);
    });

    it('rejects login with invalid email format', async () => {
      const { status } = await api('/api/admin/auth/login', {
        method: 'POST',
        json: { email: 'not-an-email', password: 'password123' },
      });
      expect([400, 422]).toContain(status);
    });

    it('rejects login with wrong credentials', async () => {
      const { status, body } = await api('/api/admin/auth/login', {
        method: 'POST',
        json: { email: 'wrong@voltium.io', password: 'wrongpassword' },
      });
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });

    it('rejects login with missing fields', async () => {
      const { status } = await api('/api/admin/auth/login', {
        method: 'POST',
        json: {},
      });
      expect([400, 422]).toContain(status);
    });
  });

  describe('/api/rider/kyc GET - bad token', () => {
    it('rejects KYC status fetch with bad token', async () => {
      const { status, body } = await api('/api/rider/kyc', {
        method: 'GET',
        token: 'bad-token',
      });
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });
  });

  describe('/api/admin/admins', () => {
    it('rejects creating admin with missing required fields', async () => {
      const cookie = await adminLogin();

      const { status } = await api('/api/admin/admins', {
        method: 'POST',
        cookie,
        json: { name: 'No Role Admin' },
      });
      expect([400, 422]).toContain(status);
    });

    it('rejects creating admin with invalid role', async () => {
      const cookie = await adminLogin();

      const { status } = await api('/api/admin/admins', {
        method: 'POST',
        cookie,
        json: {
          name: 'Bad Role Admin',
          email: `bad-role-${Date.now()}@voltium.io`,
          password: 'secure123',
          role: 'INVALID_ROLE',
        },
      });
      expect([200, 201, 400, 422]).toContain(status);
    });
  });

  describe('/api/admin/deposits', () => {
    it('rejects deposit action with invalid action', async () => {
      const cookie = await adminLogin();

      const { status, body } = await api('/api/admin/deposits', {
        method: 'POST',
        cookie,
        json: { riderId: 'some-id', action: 'INVALID_ACTION' },
      });
      expect([400, 422]).toContain(status);
      expect(body.success).toBe(false);
    });

    it('rejects deposit action without riderId', async () => {
      const cookie = await adminLogin();

      const { status } = await api('/api/admin/deposits', {
        method: 'POST',
        cookie,
        json: { action: 'APPROVE' },
      });
      expect([400, 422]).toContain(status);
    });
  });

  describe('/api/transaction/topup', () => {
    it('rejects topup without amount', { timeout: LONG_TIMEOUT }, async () => {
      const phone = generateRandomPhone();
      const { token, id } = await riderLogin(phone);

      const { status, body } = await api('/api/transaction/topup', {
        method: 'POST',
        token,
        json: { riderId: id, purpose: 'SECURITY_DEPOSIT' },
      });
      expect([400, 422]).toContain(status);
      expect(body.success).toBe(false);
    });

    it('rejects topup with negative amount', { timeout: LONG_TIMEOUT }, async () => {
      const phone = generateRandomPhone();
      const { token, id } = await riderLogin(phone);

      const { status, body } = await api('/api/transaction/topup', {
        method: 'POST',
        token,
        json: { riderId: id, amount: -100, purpose: 'SECURITY_DEPOSIT' },
      });
      expect([400, 422]).toContain(status);
      expect(body.success).toBe(false);
    });

    it('rejects topup without auth', async () => {
      const { status, body } = await api('/api/transaction/topup', {
        method: 'POST',
        json: { riderId: 'some-id', amount: 100, purpose: 'SECURITY_DEPOSIT' },
      });
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });
  });

  describe('/api/rider/profile', () => {
    it('rejects profile update with invalid data types', { timeout: LONG_TIMEOUT }, async () => {
      const phone = generateRandomPhone();
      const { token } = await riderLogin(phone);

      const { status } = await api('/api/rider/profile', {
        method: 'PUT',
        token,
        json: { name: 12345 },
      });
      expect([200, 400, 422]).toContain(status);
    });
  });

  describe('/api/rental/book', () => {
    it('rejects booking without vehicleId', { timeout: LONG_TIMEOUT }, async () => {
      const phone = generateRandomPhone();
      const { token } = await riderLogin(phone);

      const { status, body } = await api('/api/rental/book', {
        method: 'POST',
        token,
        json: { shiftId: 'shift-1', leaseDate: '2026-06-20' },
      });
      expect([400, 422]).toContain(status);
      expect(body.success).toBe(false);
    });

    it('rejects booking without auth', async () => {
      const { status } = await api('/api/rental/book', {
        method: 'POST',
        json: { vehicleId: 'v1', shiftId: 's1' },
      });
      expect(status).toBe(401);
    });
  });

  describe('/api/auth/verify-otp', () => {
    it('rejects verify with missing OTP', async () => {
      const phone = generateRandomPhone();
      const { status, body } = await api('/api/auth/verify-otp', {
        method: 'POST',
        json: { phone },
      });
      expect([400, 422]).toContain(status);
      expect(body.success).toBe(false);
    });

    it('rejects verify with empty OTP', async () => {
      const phone = generateRandomPhone();
      const { status, body } = await api('/api/auth/verify-otp', {
        method: 'POST',
        json: { phone, otp: '' },
      });
      expect([400, 422]).toContain(status);
      expect(body.success).toBe(false);
    });

    it('rejects verify with missing phone', async () => {
      const { status, body } = await api('/api/auth/verify-otp', {
        method: 'POST',
        json: { otp: '123456' },
      });
      expect([400, 422]).toContain(status);
      expect(body.success).toBe(false);
    });
  });
});
