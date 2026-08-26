# ADR 0005: Outbox Pattern

## Status
Accepted

## Context
When processing transactions (e.g., wallet top-ups), we need to safely execute the database transaction and asynchronously fire side-effects (like sending an SMS, Push Notification, or webhook to a third-party ledger) without risking dual-writes or lost messages if the Node process crashes after the DB commit.

## Decision
We chose the **Transactional Outbox Pattern**. 

## Consequences
- **Pros**: Guarantees at-least-once delivery of side-effects. The `OutboxEvent` is committed in the same database transaction as the business entity change.
- **Cons**: Requires a background worker or cron job to poll the `OutboxEvent` table and process pending events. Potential for duplicate processing, which must be handled via idempotency in the downstream systems.
