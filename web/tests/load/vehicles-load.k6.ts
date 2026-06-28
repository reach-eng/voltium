/**
 * k6 Load Test — GET /api/vehicles
 *
 * Simulates 100 concurrent users fetching the vehicle list.
 * Target: p95 response time < 500ms, 0 errors.
 *
 * Prerequisites:
 *   1. Install k6: https://k6.io/docs/get-started/installation/
 *   2. Start the dev server: npm run dev
 *   3. Seed the database: npm run db:seed
 *   4. Run: k6 run tests/load/vehicles-load.k6.ts
 *
 * Environment variables:
 *   BASE_URL — The API base URL (default: http://localhost:8081)
 *   AUTH_TOKEN — A valid rider session JWT (required)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ──────────────────────────────────────────────────────────
const errorRate = new Rate('errors');
const vehicleListDuration = new Trend('vehicle_list_duration', true);

// ── Configuration ───────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export const options = {
  scenarios: {
    vehicles_list: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },   // ramp up to 50 VUs
        { duration: '20s', target: 100 },  // ramp up to 100 VUs
        { duration: '30s', target: 100 },  // hold at 100 VUs
        { duration: '10s', target: 0 },    // ramp down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
    vehicle_list_duration: ['p(95)<500'],
  },
};

// ── Test function ───────────────────────────────────────────────────────────
export default function () {
  if (!AUTH_TOKEN) {
    console.error('❌ AUTH_TOKEN environment variable is required.');
    console.error('   Generate one by logging in and extracting the session cookie.');
    return;
  }

  const params = {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    tags: { name: 'GET /api/vehicles' },
  };

  // Use a common hub ID from seed data
  const hubId = 'hub-default';
  const url = `${BASE_URL}/api/vehicles?hubId=${hubId}`;

  const res = http.get(url, params);

  // Record custom metric
  vehicleListDuration.add(res.timings.duration);

  // Validate response
  const passed = check(res, {
    'status is 200': (r) => r.status === 200,
    'response has data': (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return body.success === true;
      } catch {
        return false;
      }
    },
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!passed);

  sleep(1);
}

// ── Summary handler ─────────────────────────────────────────────────────────
export function handleSummary(data: any) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const failRate = data.metrics.http_req_failed?.values?.rate || 0;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Vehicle List Load Test — Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total requests: ${data.metrics.http_reqs?.values?.count || 0}`);
  console.log(`  p95 duration:   ${p95.toFixed(2)}ms`);
  console.log(`  Fail rate:      ${(failRate * 100).toFixed(2)}%`);
  console.log(
    `  Threshold:      ${p95 < 500 ? '✅ PASS' : '❌ FAIL'} (p95 < 500ms)`
  );
  console.log(
    `  Error rate:     ${failRate < 0.01 ? '✅ PASS' : '❌ FAIL'} (< 1%)`
  );
  console.log('═══════════════════════════════════════════════════════\n');

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}


