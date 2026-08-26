# ADR 0006: Idempotency Keys

## Status
Accepted

## Context
Payment operations and wallet ledgers must never be executed twice, even if the client experiences a network timeout and retries the request.

## Decision
We enforce the use of an `Idempotency-Key` header on all mutation endpoints related to financial operations (e.g., POST `/api/rentals`, POST `/api/wallet/topup`).

## Consequences
- **Pros**: Protects against double-charging. The key is stored uniquely in the database alongside the transaction or ledger entry. Subsequent requests with the same key will return the cached result of the original transaction.
- **Cons**: Requires clients to generate and store UUIDs for mutations.
