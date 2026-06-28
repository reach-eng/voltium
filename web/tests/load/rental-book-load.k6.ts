/**
 * k6 Load Test — POST /api/rental/book
 *
 * Simulates 50 concurrent users attempting to book a vehicle rental.
 * Target: p95 response time < 2s, 0 errors (excluding expected conflicts).
 *
 * Prerequisites:
 *   1. Install k6: https://k6.io/docs/get-started/installation/
 *   2. Start the dev server: npm run dev
 *   3. Seed the database: npm run db:seed
 *   4. Run: k6 run tests/load/rental-book-load.k6.ts
 *
 * Environment variables:
 *   BASE_URL — The API base URL (default: http://localhost:8081)
 *   AUTH_TOKEN — A valid rider session JWT (required)
 *   VEHICLE_ID — A valid vehicle ID from seed data (required)
 *   SHIFT_ID — A valid shift ID from seed data (required)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ── Custom metrics ──────────────────────────────────────────────────────────
const errorRate = new Rate('errors');
const bookingDuration = new Trend('booking_duration', true);
const conflictCount = new Counter('expected_conflicts');

// ── Configuration ───────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const VEHICLE_ID = __ENV.VEHICLE_ID || '';
const SHIFT_ID = __ENV.SHIFT_ID || '';

export const options = {
  scenarios: {
    rental_booking: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 25 },   // ramp up to 25 VUs
        { duration: '20s', target: 50 },   // ramp up to 50 VUs
        { duration: '30s', target: 50 },   // hold at 50 VUs
        { duration: '10s', target: 0 },    // ramp down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    // Allow up to 10% "errors" — most will be 409 Conflict from concurrent bookings
    http_req_failed: ['rate<0.10'],
    booking_duration: ['p(95)<2000'],
  },
};

// ── Test function ───────────────────────────────────────────────────────────
export default function () {
  if (!AUTH_TOKEN) {
    console.error('❌ AUTH_TOKEN environment variable is required.');
    return;
  }
  if (!VEHICLE_ID || !SHIFT_ID) {
    console.error('❌ VEHICLE_ID and SHIFT_ID environment variables are required.');
    return;
  }

  const params = {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    tags: { name: 'POST /api/rental/book' },
  };

  // Generate a random date within the next 7 days
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + randomIntBetween(1, 7));
  const leaseDate = futureDate.toISOString().split('T')[0];

  // Random start time between 06:00 and 18:00
  const hour = randomIntBetween(6, 17);
  const startTime = `${hour.toString().padStart(2, '0')}:00`;

  const payload = JSON.stringify({
    vehicleId: VEHICLE_ID,
    shiftId: SHIFT_ID,
    leaseDate,
    startTime,
  });

  const url = `${BASE_URL}/api/rental/book`;
  const res = http.post(url, payload, params);

  // Record custom metric
  bookingDuration.add(res.timings.duration);

  // Validate response
  const passed = check(res, {
    'status is 200 or 409': (r) => r.status === 200 || r.status === 409,
    'response time < 2s': (r) => r.timings.duration < 2000,
    '200 has success body': (r) => {
      if (r.status !== 200) return true; // Skip for 409
      try {
        const body = JSON.parse(r.body as string);
        return body.success === true;
      } catch {
        return false;
      }
    },
    '409 has conflict message': (r) => {
      if (r.status !== 409) return true; // Skip for 200
      try {
        const body = JSON.parse(r.body as string);
        return body.error !== undefined;
      } catch {
        return false;
      }
    },
  });

  // Track expected conflicts separately
  if (res.status === 409) {
    conflictCount.add(1);
  }

  errorRate.add(!passed);

  sleep(1);
}

// ── Summary handler ─────────────────────────────────────────────────────────
export function handleSummary(data: any) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const failRate = data.metrics.http_req_failed?.values?.rate || 0;
  const conflicts = data.metrics.expected_conflicts?.values?.count || 0;
  const totalReqs = data.metrics.http_reqs?.values?.count || 0;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Rental Booking Load Test — Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total requests:     ${totalReqs}`);
  console.log(`  Expected conflicts: ${conflicts} (409 — not errors)`);
  console.log(`  p95 duration:       ${p95.toFixed(2)}ms`);
  console.log(`  Fail rate:          ${(failRate * 100).toFixed(2)}%`);
  console.log(
    `  Duration threshold: ${p95 < 2000 ? '✅ PASS' : '❌ FAIL'} (p95 < 2s)`
  );
  console.log(
    `  Error rate:         ${failRate < 0.10 ? '✅ PASS' : '❌ FAIL'} (< 10%)`
  );
  console.log('═══════════════════════════════════════════════════════\n');

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}


