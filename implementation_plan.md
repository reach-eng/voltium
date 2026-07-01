# Worker Dispatcher & Clock Injection Plan

## Goal
Confirm and refactor the `Clock` injection pattern in `web/src/server/workers/index.ts` to allow deterministic testing of worker time-based logic (e.g., retries, backoffs, schedulers), and add an integration test that demonstrates this end-to-end.

## User Review Required
- I will modify `startWorkers()` to accept an explicit `IClock` dependency. Should I also propagate this `clock` instance down to `JobQueue.processJobs` and `JobQueue.enqueue`, or is it sufficient to rely on `clock.set()` globally for the `JobQueue` while the dispatcher explicit parameter is just for the scheduled loops? 
- For the integration test (F2), I will write a test for the `notification-dispatch` worker (or similar) that enqueues a job, makes it fail, advances the injected clock to bypass the exponential backoff, and verifies the retry succeeds.

## Proposed Changes

### `web/src/server/workers/index.ts`
- Update `startWorkers(injectedClock?: Clock)` to accept an optional `Clock` parameter (defaulting to the global `clock`).
- Update all scheduler loops (`runReaperLoop`, `runScheduledBackupLoop`, `SCHEDULED_TASKS`) to use `injectedClock` instead of the globally imported `clock`.

### `web/tests/unit/workers/dispatcher.integration.test.ts`
- [NEW] Create an integration test that starts the dispatcher with a mock clock.
- Verify job enqueue -> failure -> `readyAt` backoff is set.
- Advance the mock clock past the backoff window.
- Verify the worker picks it up again on the next polling cycle and completes it.

### `docs/TESTING_STRATEGY.md`
- Append the `Clock` dependency injection pattern under the Mocking Strategy section.

## Verification Plan
### Automated Tests
- Run `npm run test:unit -- --run tests/unit/workers/dispatcher.integration.test.ts` to verify the new integration test passes and backoffs work correctly with the mock clock.
