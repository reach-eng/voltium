# Voltium API Documentation

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "optional message",
  "pagination": { "page": 1, "limit": 10, "total": 100, "totalPages": 10 }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Human readable error message",
  "code": "ERROR_CODE"
}
```

## Error Codes

| Code               | Description             | HTTP Status |
| ------------------ | ----------------------- | ----------- |
| `BAD_REQUEST`      | Invalid input           | 400         |
| `UNAUTHORIZED`     | Authentication required | 401         |
| `FORBIDDEN`        | Access denied           | 403         |
| `NOT_FOUND`        | Resource not found      | 404         |
| `CONFLICT`         | Resource already exists | 409         |
| `VALIDATION_ERROR` | Validation failed       | 422         |
| `RATE_LIMITED`     | Too many requests       | 429         |
| `SERVER_ERROR`     | Internal server error   | 500         |

## Authentication

### Send OTP

```http
POST /api/auth/send-otp
Content-Type: application/json

{ "phone": "9999900001" }
```

### Verify OTP

```http
POST /api/auth/verify-otp
Content-Type: application/json

{ "phone": "9999900001", "otp": "123456" }
```

## Rider Endpoints

### Get Profile

```http
GET /api/rider/profile?riderId=xxx
```

### Update Profile

```http
PUT /api/rider/profile
Content-Type: application/json

{
  "fullName": "John Doe",
  "email": "john@example.com",
  "fatherName": "John Sr",
  "currentAddress": "123 Main St"
}
```

### Submit KYC

```http
POST /api/rider/kyc
Content-Type: application/json

{
  "riderId": "xxx",
  "aadhaarNumber": "1234-5678-9012",
  "panNumber": "ABCDE1234F",
  "bankName": "HDFC Bank",
  "bankAccount": "1234567890",
  "bankIfsc": "HDFC0001234"
}
```

### Submit Guarantor

```http
POST /api/rider/guarantor
Content-Type: application/json

{
  "riderId": "xxx",
  "name": "Jane Doe",
  "relation": "father",
  "phone": "9999900002"
}
```

## Admin Endpoints

### Dashboard Stats

```http
GET /api/admin/dashboard
```

### List Riders

```http
GET /api/admin/riders?page=1&limit=10&state=ONBOARDING
```

### Create Rider

```http
POST /api/admin/riders
Content-Type: application/json

{
  "phone": "9999900001",
  "fullName": "John Doe"
}
```

### Update Rider

```http
PUT /api/admin/riders/:id
Content-Type: application/json

{
  "state": "ACTIVE",
  "kycApproved": true
}
```

### List Transactions

```http
GET /api/admin/transactions?status=PENDING&page=1&limit=20
```

### Approve Transaction

```http
PUT /api/admin/transactions
Content-Type: application/json

{
  "id": "tx-xxx",
  "action": "APPROVE"
}
```

### List Support Tickets

```http
GET /api/admin/tickets?status=OPEN&priority=HIGH
```

### Update Ticket

```http
PUT /api/admin/tickets
Content-Type: application/json

{
  "id": "ticket-xxx",
  "status": "RESOLVED",
  "resolution": "Issue resolved"
}
```

## Validation Schemas

All POST/PUT requests should use the validators defined in `src/lib/validators.ts`:

- `sendOtpSchema`
- `verifyOtpSchema`
- `updateProfileSchema`
- `submitKycSchema`
- `submitGuarantorSchema`
- `subscribePlanSchema`
- `topUpSchema`
- `createTicketSchema`
