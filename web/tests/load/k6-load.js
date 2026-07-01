import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

// Custom metrics to track latency separately
const vehicleLatency = new Trend('vehicles_latency');
const bookingLatency = new Trend('booking_latency');

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 users
    { duration: '1m', target: 50 },  // Stay at 50 users
    { duration: '30s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    'vehicles_latency': ['p(95)<200'], // p95 must be under 200ms
    'booking_latency': ['p(95)<500'],  // p95 must be under 500ms
    'http_req_failed': ['rate<0.01'],  // errors should be less than 1%
  },
};

const BASE_URL = __ENV.API_URL || 'http://127.0.0.1:8081';

export default function () {
  // 1. Fetch vehicles
  const vehiclesRes = http.get(`${BASE_URL}/api/vehicles`);
  
  check(vehiclesRes, {
    'vehicles status is 200': (r) => r.status === 200,
  });
  
  vehicleLatency.add(vehiclesRes.timings.duration);

  // Short wait before booking
  sleep(1);

  // 2. Simulate booking
  const payload = JSON.stringify({
    vehicleId: 'test-vehicle-id',
    shiftId: 'test-shift-id',
    leaseDate: new Date().toISOString().split('T')[0]
  });

  const headers = {
    'Content-Type': 'application/json',
    // Mock token or assume the environment disables auth for load test
    'Authorization': 'Bearer test-token'
  };

  const bookingRes = http.post(`${BASE_URL}/api/rentals`, payload, { headers });

  // In a real environment we might expect 201 or 400 (if no auth/invalid mock data), 
  // but we are primarily testing latency here. We accept 400/401/201 as long as the 
  // request was processed and didn't result in a 500.
  check(bookingRes, {
    'booking processed without server error': (r) => r.status < 500,
  });

  bookingLatency.add(bookingRes.timings.duration);

  sleep(1);
}
