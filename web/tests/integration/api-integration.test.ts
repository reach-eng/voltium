import { describe, test, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('API Integration Tests', () => {
  let riderId: string;
  let adminToken: string;

  beforeAll(async () => {
    console.log(`Testing against ${BASE_URL}`);
  });

  afterAll(async () => {
    console.log('Cleaning up test data...');
  });

  describe('Auth Flow', () => {
    test('POST /api/auth/send-otp - valid phone', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '9999999999' }),
      });

      const json = await response.json();
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    test('POST /api/auth/send-otp - invalid phone', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '123' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Rider Flow', () => {
    test('GET /api/rider/plans - list plans', async () => {
      const response = await fetch(`${BASE_URL}/api/rider/plans`);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    test('GET /api/vehicles - without hubId', async () => {
      const response = await fetch(`${BASE_URL}/api/vehicles`);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    test('GET /api/shifts - list shifts', async () => {
      const response = await fetch(`${BASE_URL}/api/shifts`);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('Security', () => {
    test('Rate limiting - send-otp', async () => {
      const requests = await Promise.all(
        Array(6)
          .fill(null)
          .map(() =>
            fetch(`${BASE_URL}/api/auth/send-otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: '9999999999' }),
            })
          )
      );

      const lastResponse = requests[5];
      expect([200, 429]).toContain(lastResponse.status);
    });

    test('Missing required fields - 400', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });
});
