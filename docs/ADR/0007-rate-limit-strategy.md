# ADR 0007: Rate Limiting Strategy

## Status
Accepted

## Context
Public-facing endpoints like `/api/auth/login` (SMS OTP delivery) are highly susceptible to bot attacks, which can incur massive SMS gateway costs and degrade service quality.

## Decision
We enforce layered rate limits at both the edge (via our proxy/load balancer) and the application layer using Redis. 

## Consequences
- **Pros**: Specific granular control per endpoint (e.g., 3 OTP requests per 15 minutes per phone number). Application-level errors yield descriptive `429 Too Many Requests` responses with `Retry-After` headers.
- **Cons**: Requires a highly available Redis instance. If Redis goes down, we fallback to in-memory sliding windows (which do not sync across horizontally scaled PM2 processes).
