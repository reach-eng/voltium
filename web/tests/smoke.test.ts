import { test, expect } from 'vitest';

const BASE_URL = 'http://localhost:3000';

test('POST /api/rider/kyc smoke test', async () => {
  const payload = {
    riderId: 'rider-1',
    aadhaarNumber: '1234-5678-9012',
    panNumber: 'ABCDE1234F',
    bankName: 'HDFC',
    bankAccount: '1234567890',
    bankIfsc: 'HDFC0001234',
    aadhaarFront: 'https://example.com/front.jpg',
    aadhaarBack: 'https://example.com/back.jpg',
    panCard: 'https://example.com/pan.jpg',
    signature: 'https://example.com/sig.png',
  };

  const response = await fetch(`${BASE_URL}/api/rider/kyc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data.success).toBe(true);
});

test('PUT /api/rider/profile Vehicle Return smoke test', async () => {
  const payload = {
    riderId: 'rider-1',
    returnPending: true,
    returnPhotos: [
      'https://example.com/left.jpg',
      'https://example.com/right.jpg',
      'https://example.com/front.jpg',
      'https://example.com/speedo.jpg',
    ],
    returnReason: 'End of shift',
    latitude: 12.9716,
    longitude: 77.5946,
  };

  const response = await fetch(`${BASE_URL}/api/rider/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data.success).toBe(true);
  expect(data.data.rentalStatus).toBe('PENDING_RETURN');
});
