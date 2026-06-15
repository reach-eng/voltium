import { test, expect } from '@playwright/test';

/**
 * End‑to‑end test for the authentication flow.
 * It exercises the following API endpoints:
 *   - POST /api/auth/send-otp
 *   - POST /api/auth/verify-otp
 *   - GET  /api/rider/profile
 */

test('auth flow: send OTP, verify OTP, fetch profile', async ({ request }) => {
  // Use a deterministic but unique phone number for the test run
  const phone = `999990000${Date.now() % 10}`;

  // ---------- Send OTP ----------
  const sendRes = await request.post('/api/auth/send-otp', {
    data: { phone },
  });
  expect(sendRes.ok()).toBeTruthy();
  const sendBody = await sendRes.json();
  expect(sendBody.success).toBe(true);
  // In dev mode the OTP is returned in the response for testing
  const otp = sendBody.data?.otp;
  expect(otp).toBeDefined();

  // ---------- Verify OTP ----------
  const verifyRes = await request.post('/api/auth/verify-otp', {
    data: { phone, otp },
  });
  expect(verifyRes.ok()).toBeTruthy();
  const verifyBody = await verifyRes.json();
  expect(verifyBody.success).toBe(true);
  const riderId = verifyBody.data?.riderId;
  expect(riderId).toBeDefined();

  // ---------- Get Rider Profile ----------
  const profileRes = await request.get(`/api/rider/profile?riderId=${riderId}`);
  expect(profileRes.ok()).toBeTruthy();
  const profileBody = await profileRes.json();
  expect(profileBody.success).toBe(true);
  expect(profileBody.data?.phone).toBe(phone);
});
