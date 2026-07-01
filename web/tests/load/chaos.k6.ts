/**
 * k6 Chaos Test — DB Latency Simulation
 *
 * Simulates high latency in database queries to ensure the API
 * handles timeouts gracefully without crashing or returning 500s.
 *
 * Run: k6 run tests/load/chaos.k6.ts
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081';

export const options = {
  scenarios: {
    chaos_scenario: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
    },
  },
  thresholds: {
    // We expect requests to fail or take long, but we want the service to stay up
    http_req_failed: ['rate<0.50'], 
  },
};

export default function () {
  // Hit a route that might be affected by DB latency
  const url = `${BASE_URL}/api/public/ping`;
  const res = http.get(url, {
    headers: {
      'X-Chaos-Inject-Latency': 'true'
    }
  });

  check(res, {
    'status is 200 or 503': (r) => r.status === 200 || r.status === 503,
  });

  sleep(1);
}
