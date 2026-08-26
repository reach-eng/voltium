# Voltium API Documentation

This document describes the primary REST endpoints available to client applications (Flutter App and Admin Web).

## API Versioning

Routes under `/api/v1/*` are **stable, externally-documented contracts**. The `v1/` prefix signals that the route's path, request shape, and response shape are part of the published API surface (mirrored in `web/src/contracts/openapi.ts` and `web/src/contracts/openapi.json`) and will not change without a deprecation cycle. Routes outside the `v1/` prefix are internal and may evolve without notice.

**Current v1 routes:** `/api/v1/payment-gateways/active` (active payment gateway list for the rider app's payment screen).

## Authentication Flow

Voltium uses HTTP-only cookies for authentication tokens (`auth_token`, `refresh_token`), protecting against XSS attacks.

### `POST /api/auth/login`
Initiates the login flow by sending an SMS OTP to the provided phone number.
- **Request Body**: `{ "phone": "+919876543210" }`
- **Response**: `200 OK` (OTP sent)
- **Rate Limit**: 3 per 15 minutes.

### `POST /api/auth/verify-otp`
Verifies the OTP and issues a JWT session.
- **Request Body**: `{ "phone": "+919876543210", "otp": "123456" }`
- **Response**: `200 OK` with `Set-Cookie` headers for `auth_token` and `refresh_token`.

### `POST /api/auth/refresh`
Refreshes an expired `auth_token` using a valid `refresh_token`.

---

## Rider Core API

### `GET /api/vehicles?hubId={hubId}`
Fetches the active list of vehicles for a given hub.
- **Response**: `200 OK` with a cached list of vehicles.

### `POST /api/rentals`
Initiates a vehicle booking.
- **Headers**: `Idempotency-Key: <uuid>`
- **Request Body**: `{ "vehicleId": "...", "shiftId": "...", "leaseDate": "YYYY-MM-DD" }`
- **Response**: `201 Created`

### `GET /api/wallet/balance`
Retrieves the real-time wallet and deposit balance.
- **Response**: `200 OK` `{ "balanceInPaise": 50000, "securityDeposit": 100000 }`

---

## Webhooks

Voltium accepts incoming webhooks from external payment providers to verify and reconcile wallet top-ups and deposit payments.

### `POST /api/webhooks/razorpay`
- **Headers**: `X-Razorpay-Signature: <hmac-sha256>`
- **Behavior**: The application verifies the signature against the pre-configured secret. Valid events trigger an outbox event, while invalid signatures return a `400 Bad Request`.

---

## Error Handling & Status Codes
All responses conform to the standard API structure.

**Successful Response**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error Response**
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid input provided"
  }
}
```

- **400 Bad Request**: Invalid input, Zod validation failure.
- **401 Unauthorized**: Missing or invalid session token.
- **403 Forbidden**: Valid token, but insufficient RBAC permissions.
- **404 Not Found**: Resource does not exist.
- **409 Conflict**: State transition failure (e.g., booking an unavailable vehicle).
- **429 Too Many Requests**: Rate limit exceeded.
- **500 Internal Server Error**: Unexpected backend fault.
