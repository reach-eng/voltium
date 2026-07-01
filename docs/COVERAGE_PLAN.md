# Voltium Coverage Plan — Meaningful 100%

> **Created**: 2026-06-29
> **Companion to**: [`web/tests/TESTING_PLAN.md`](../web/tests/TESTING_PLAN.md)
> **Goal**: Close the remaining test-coverage gaps identified in the 2026-06-29 audit. The 5 phases in TESTING_PLAN.md addressed the highest-priority work; this plan covers the rest.
> 
> **Status**: 🎉 ALL PHASES COMPLETE (As of Day 32, Phase K). The system has reached its >85% coverage thresholds.

---

## 1. Scope Definition

### In Scope (must be tested)

- All business logic: services, providers, use-cases, repositories, route handlers, state machines, worker jobs
- All UI screens (at least one widget/golden test per screen)
- All public utility functions
- All middleware and shared server modules

### Out of Scope (excluded from coverage targets)

| Category | Examples | Reason |
|---|---|---|
| Generated code | `*.g.dart`, `*.freezed.dart`, `web/src/contracts/openapi.json`, `flutter/lib/core/network/generated/*` | Auto-generated; not hand-authored |
| Type-only files | Enums with no behavior, `index.ts` re-exports | No logic to test |
| Trivial getters/setters | Pure pass-through properties | No behavior to test |
| Static config | `app_constants.dart`, `app_info.dart`, brand colors, design tokens, build configs | No logic to test |
| Migration files | Prisma `migration.sql` files | Covered as smoke tests in CI |
| Lockfiles | `package-lock.json`, `pubspec.lock` | No logic |

**Exclusion patterns** (apply to coverage tools):

```ts
// vitest.config.ts (web)
coverage: {
  exclude: [
    'src/contracts/**',
    'src/**/__mocks__/**',
    '**/*.d.ts',
    'src/lib/openapi-types.ts'
  ]
}
```

```yaml
# flutter coverage exclusion (via lcov)
# Apply with: lcov --remove coverage/lcov.info "*.g.dart" "**/generated/**" "**/config/**" "**/theme/**" -o coverage/lcov.filtered.info
```

---

## 2. Coverage Tooling & Gates

### Web (vitest 4)

`web/vitest.config.ts`:

```ts
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'lcov'],
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['src/contracts/**', 'src/**/__mocks__/**', '**/*.d.ts'],
    thresholds: {
      lines: 85,
      branches: 75,
      functions: 85,
      statements: 85
    }
  }
}
```

### Flutter

`pubspec.yaml`:

```yaml
dev_dependencies:
  test: ^1.25.0
```

CI step (after unit tests):

```bash
flutter test --coverage
lcov --summary coverage/lcov.info
# Optional diff coverage: lcov --diff coverage/lcov.info origin/main --summary
```

### CI Thresholds

| Layer | Lines | Branches | Notes |
|---|---|---|---|
| Web | 85% | 75% | Allow wiggle room for type guards |
| Flutter | 80% | 70% | Lower because golden tests are heavyweight |
| New code (diff) | 95% | 85% | SonarQube-style enforcement |

CI workflow update (`.github/workflows/ci-cd.yml`): run coverage as a separate step after unit tests, fail build if thresholds not met, upload `coverage/` as artifact.

### Documentation

- Add `docs/TESTING_STRATEGY.md` with: scope, exclusion list, golden-update workflow (`flutter test --update-goldens`), how to add new tests
- Update `AGENTS.md` with coverage requirements for new PRs

---

## 3. Decisions (Confirmed)

| Question | Decision | Implication |
|---|---|---|
| Money-path mocking | **C: Real Postgres** | Use testcontainers per file; CI Postgres service as host. Trustworthy for ledger correctness. |
| Worker job isolation | **Real timers with `Clock` injection, via dispatcher** | Tests enqueue, advance `Clock`, drain dispatcher, assert side effects. |
| Flutter widget strategy | **Golden tests** | Per-widget per-state, single device pixel ratio (1.0), manual update via `flutter test --update-goldens`. |
| Delivery | **5 phased milestones** | Each phase ships and merges independently. |
| Coverage tooling | **Yes, CI-enforced** | vitest v8 (web) + flutter test --coverage (Flutter). |

### Money-path test isolation (confirmed)

- **Per-file testcontainers**: each test file gets a fresh Postgres container with its own schema
- **CI uses existing Postgres 16 service** (`.github/workflows/ci-cd.yml`)
- No new infrastructure required

### Golden file strategy (confirmed)

- Per-widget, per-state (e.g., `wallet_screen_empty.png`, `wallet_screen_loaded.png`)
- Single device pixel ratio (1.0)
- Update via `flutter test --update-goldens` on intentional changes; PR review required
- Render in both light and dark theme (recommended addition during Phase 5d execution)

---

## 4. Phase 1 — Money Paths (Web)

**Goal**: 100% coverage on financial and identity surface. Highest leverage — money paths in production.

**Infrastructure**:

- Reuse `web/tests/_setup/test-postgres.ts` (or create if missing) to spin up a Postgres container per test file
- CI already provides Postgres 16 service; tests run against `localhost:5432` with `voltium_test` creds
- Tests in `web/tests/unit/money/` to group financial tests

**Files to test** (using real DB):

| File | Tests | Notes |
|---|---:|---|
| `wallet/wallet.service.ts` | ~25 | Double-entry, reversal, hold/release, deposit separation |
| `wallet/wallet-ledger.service.ts` | ~15 | Idempotency, balance invariants, partial reversal |
| `deposits/deposit.service.ts` | ~20 | Hold, refund, forfeit, partial refund |
| `deposits/deposit-ledger.service.ts` | ~10 | Link to wallet ledger |
| `transactions/transaction.service.ts` | ~25 | Topup, debit, credit, reverse, status transitions |
| `transactions/transaction.repository.ts` | ~10 | Direct Prisma queries |
| `kyc/kyc.repository.ts` | ~12 | Direct Prisma queries |
| `rentals/rental.service.ts` | ~25 | Book, start, end, return, schedule |
| `rentals/rental.repository.ts` | ~10 | Direct |
| `wallet/wallet.repository.ts` | ~10 | Direct |

**Total**: ~162 tests in ~10 files

**CI consideration**: Phase 1 tests need Postgres. The existing `ci-cd.yml` already provisions one for integration tests. May need to reorder or merge Phase 1 with the integration test stage.

**Effort**: 3 days

---

## 5. Phase 2 — Worker Jobs (Web)

**Goal**: 100% coverage on all 12 worker jobs via dispatcher with real timer injection.

**Infrastructure**:

- Modify `web/src/server/workers/index.ts` (or create `web/src/server/workers/clock.ts`) to accept a `Clock` instance, defaulting to `Clock()` in production
- Each test enqueues a job, advances the clock, drains the queue, asserts side effects
- Tests in `web/tests/unit/workers/`

**Files to test**:

| File | Tests | Side effects to assert |
|---|---:|---|
| `reconciliation.job.ts` | ~15 | Ledger entries reconciled, mismatch logged |
| `wallet-reconciliation.job.ts` | ~12 | Stripe balance matches ledger |
| `rent-reminders.job.ts` | ~10 | Notifications created for due/overdue |
| `referral-reward.job.ts` | ~8 | Wallet credited |
| `scheduled-backup.job.ts` | ~8 | Backup file created |
| `audit-cleanup.job.ts` | ~6 | Old records deleted |
| `telemetry-cleanup.job.ts` | ~6 | Old records deleted |
| `notifications-cleanup.job.ts` | ~6 | Old records deleted |
| `notifications.job.ts` | ~12 | Birthday, payment, leaderboard branches |
| `device-compliance.job.ts` | ~10 | Violations detected, actions taken |
| `outbox.ts` | ~8 | Outbox writes, batch processing |

**Total**: ~101 tests in ~11 files

**Cleanup**:

- Delete or annotate `web/tests/unit/worker-jobs.test.ts` (currently asserts on local mocks, not real source). Recommend deletion since Phase 2 supersedes it.

**Effort**: 2 days

---

## 6. Phase 3 — API Routes (Web)

**Goal**: 100% coverage on the ~70 untested route handlers.

**Group A — Auth (3 routes)**: logout, refresh, verify-phone (~8 tests)

**Group B — Admin mutations (~30 routes)**: ~100 tests in `web/tests/api/admin-mutations.test.ts`
- `admin/admins` POST/PUT/DELETE
- `admin/announcements` POST/PUT/DELETE
- `admin/coupons` POST/PUT/DELETE
- `admin/hubs` POST/PUT/DELETE + bulk
- `admin/incidents/[id]`
- `admin/plans` POST/PUT/DELETE
- `admin/riders/[id]` + actions + bulk + device-data
- `admin/scores` + recalculate
- `admin/settings` POST/PUT
- `admin/shifts` CRUD
- `admin/team-leaders` + bulk
- `admin/tickets/bulk` + messages
- `admin/transactions/bulk`
- `admin/vehicles/[id]` + bulk + history
- `admin/feature-flags`, `admin/jobs`, `admin/legal`, `admin/offers`, `admin/workflow-coverage`

**Group C — Rider endpoints (~10 routes)**: ~30 tests in `web/tests/api/rider-endpoints.test.ts`
- `rider/device/verify-lock`, `rider/verify-lock-password`
- `rider/offers`, `rider/rewards`, `rider/settings`

**Group D — Public/Other (~25 routes)**: ~50 tests in `web/tests/api/public-routes.test.ts`
- `device/data`, `device/permissions`
- `notification/list`, `pricing`, `search`, `shifts`
- `support/chat`, `support/faqs`
- `sync/queue`
- `transaction/history`, `transaction/request`
- `vehicles`, `riders/register-token`
- `internal/debug`, `metrics`, `monitoring/metrics`, `monitoring/dead-letter`
- `files/local-upload/[fileRecordId]`

**Total**: ~180 tests in ~4 files (existing `api-routes.test.ts` extended)

**Effort**: 3 days

---

## 7. Phase 4 — Flutter Services & Providers

**Goal**: 100% coverage on `lib/services/` and `lib/providers/`.

**Infrastructure**:

- Centralize test helpers in `flutter/test/helpers/`:
  - `provider_test_harness.dart` — wraps providers with mocked deps
  - `api_client_mock.dart` — typed mock for `ApiClient`
  - `golden_test_harness.dart` — sets up device pixel ratio, theme, locale
- Use mocktail consistently (already used in `rider_provider_test.dart`)

**Providers** (in `flutter/test/providers/`):

| Provider | Tests |
|---|---:|
| `app_provider.dart` | ~30 |
| `device_policy_provider.dart` | ~15 |
| `support_provider.dart` | ~12 |
| `theme_provider.dart` | ~6 |
| `locale_provider.dart` | ~6 |
| `notification_provider.dart` | ~10 |
| `connectivity_provider.dart` | ~8 |
| `engagement_provider.dart` | ~8 |
| `riverpod_providers.dart` | ~5 |

**Services** (in `flutter/test/services/`):

| Service | Tests | Mocking approach |
|---|---:|---|
| `biometric_service.dart` | ~10 | `MethodChannel` mock for `local_auth` |
| `notification_service.dart` | ~12 | `MethodChannel` mock for `flutter_local_notifications` |
| `background_location_service.dart` | ~12 | `MethodChannel` mock for `geolocator` |
| `image_compression_service.dart` | ~8 | `flutter_image_compress` mock |
| `image_crop_service.dart` | ~8 | `image_cropper` mock |
| `analytics_service.dart` | ~8 | Firebase/Amplitude mocks |
| `connectivity_service.dart` | ~8 | `connectivity_plus` stream mock |
| `consent_service.dart` | ~8 | `flutter_secure_storage` mock |
| `device_data_service.dart` | ~10 | Repository mocks (already partially tested) |
| `monitoring_service.dart` | ~6 | Crashlytics/Sentry mocks |
| `performance_service.dart` | ~6 | `firebase_performance` mock |
| `receipt_service.dart` | ~8 | PDF generation mock |
| `referral_service.dart` | ~8 | API client mock |
| `share_service.dart` | ~6 | `share_plus` mock |
| `emergency_contacts_service.dart` | ~8 | `flutter_contacts` mock |

**Total**: ~250 tests in ~25 files

**Effort**: 3 days

---

## 8. Phase 5 — Flutter Repositories, Models, Utils, Screens

**Goal**: 100% coverage on remaining Flutter gaps.

**5a — Repositories (6 files, ~100 tests)** in `flutter/test/features/<feature>/data/`

| Repository | Tests |
|---|---:|
| `auth/data/repository_impl.dart` | ~15 |
| `profile/data/repository_impl.dart` | ~15 |
| `rentals/data/repository_impl.dart` | ~20 |
| `support/data/repository_impl.dart` | ~15 |
| `wallet/data/repository_impl.dart` | ~20 |
| `kyc/data/kyc_repository.dart` | ~15 |

**5b — Models (13 files, ~90 tests)** in `flutter/test/models/`

| Model | Tests |
|---|---:|
| `rider_model.dart` | ~20 |
| `hub_model.dart`, `plan_model.dart`, `reward_model.dart`, `notification_model.dart`, `earnings_entry_model.dart`, `sponsored_offer_model.dart`, `support_model.dart` | ~5 each (~35) |
| `rider_*.dart` (identity, kyc, metrics, rental, wallet) | ~5 each (~25) |
| `json_converters.dart` | ~5 |

**5c — Utils (12 files, ~95 tests)** in `flutter/test/utils/`

| Util | Tests |
|---|---:|
| `phone_validator.dart` | ~8 |
| `lifecycle_rank.dart` | ~10 |
| `date_helpers.dart` | ~8 |
| `form_validators.dart` | ~12 |
| `toast.dart`, `app_logger.dart`, `app_navigator.dart` | ~5 each (~15) |
| `form_scroll_helper.dart`, `form_utils.dart`, `page_transitions.dart`, `accessibility.dart` | ~5 each (~20) |
| `app_constants.dart`, `app_info.dart` | 0 (excluded — trivial) |

**5d — Screens (15 files) — GOLDEN TESTS** in `flutter/test/features/<feature>/presentation/screens/`

| Screen | Golden states | Tests |
|---|---|---:|
| `auth_choice_screen` | default, dark | 2 |
| `dashboard/auth_wrapper` | loading, authenticated | 2 |
| `kyc/auth_wrapper` | loading, authenticated | 2 |
| `kyc/intent_of_use_screen` | default | 1 |
| `notifications/notification_preferences_screen` | default, all-off | 2 |
| `notifications/smart_notifications_screen` | empty, populated | 2 |
| `onboarding/welcome_screen` | default | 1 |
| `onboarding/privacy_consent_screen` | default | 1 |
| `onboarding/legal_page_screen` | default | 1 |
| `rentals/plan_success_screen` | default | 1 |
| `support/support_checklist_screen` | default, completed | 2 |
| `support/ticket_status_screen` | open, resolved | 2 |
| `support/troubleshooter_result` | success, failure | 2 |
| `wallet/history_screen` | empty, populated | 2 |
| `wallet/top_up_payment_sheet_screen` | default | 1 |

**Total screens**: ~24 golden test files

**5e — Feature widgets (~30 files) — GOLDEN TESTS**
- One golden test per widget file, default state
- ~30 test files, ~1 test each = ~30 tests

**5f — Cleanup**:
- Delete `web/tests/realistic/_bootstrap/` (empty)
- Delete 9 placeholder `web/e2e/*.spec.ts` files (consolidated into `rider-flutter-tests.spec.ts`)
- Replace `flutter/test/widget_test.dart` (placeholder) with meaningful first-launch smoke
- Consolidate redundant `flutter/integration_test/` root files into `e2e_individual/`

**Total Phase 5**: ~340 tests in ~85 files

**Effort**: 5 days

---

## 9. Total Estimate

| Phase | New tests | New files | Effort (days) |
|---|---:|---:|---:|
| 1. Money paths (web) | ~162 | ~10 | 3 |
| 2. Worker jobs (web) | ~101 | ~11 | 2 |
| 3. API routes (web) | ~180 | ~4 | 3 |
| 4. Flutter services+providers | ~250 | ~25 | 3 |
| 5. Flutter repos+models+utils+screens | ~340 | ~85 | 5 |
| Coverage tooling + docs + helpers | — | ~10 | 1 |
| **Total** | **~1,033** | **~145** | **~17 days** |

**Final test count**: ~2,099 (current) + ~1,033 (new) = **~3,132 automated test cases**.

---

## 10. Risks & Tradeoffs

| Risk | Mitigation |
|---|---|
| **Test brittleness** (tightly coupled to implementation) | Use golden-master tests for screens, behavior tests for state machines, not deep mocks |
| **Mock maintenance** (250+ new mock-heavy Flutter tests) | Centralize helpers in `flutter/test/helpers/`; use `mocktail` consistently |
| **Generated code drift** (openapi.json → generated client changes) | Don't test generated code; rely on contract tests |
| **Money-path test isolation failures** (nested transactions, commit/rollback) | Testcontainers per file (no shared state) |
| **Worker job time travel** (Clock injection across distributed calls) | Use `package:clock` consistently; document injection point in `dispatcher.ts` |
| **Golden test maintenance** (30+ screens, intentional UI changes) | PR review required for `--update-goldens`; codify in `AGENTS.md` |
| **CI runtime** (additional Postgres tests, golden comparisons) | Run money paths + worker jobs in parallel with existing integration tests; budget 5-10 min extra CI time |

---

## 11. Execution Order

Recommended sequencing for risk reduction:

1. **Phase 1 (Money paths)** — Highest leverage. Sets the pattern for real-DB testing.
2. **Phase 4 (Flutter services+providers)** — High failure rate today, central to app reliability.
3. **Phase 2 (Worker jobs)** — Requires dispatcher refactor; do after Phase 1 patterns are established.
4. **Phase 3 (API routes)** — Most mechanical; can be parallelized.
5. **Phase 5 (Flutter repos/models/utils/screens)** — Largest volume; do after Flutter test helpers are battle-tested in Phase 4.

Each phase ships as a single PR (or 2-3 sub-PRs for Phase 5) with:
- Updated coverage report
- CI passing
- New test files added (no source code changes unless refactoring for testability)

---

## 12. Related Documents

- [`web/tests/TESTING_PLAN.md`](../web/tests/TESTING_PLAN.md) — Phases 1-5 (complete)
- `AGENTS.md` — Agent context, key commands
- `.github/workflows/ci-cd.yml` — CI pipeline
- `web/vitest.config.ts` — vitest config (where thresholds go)
- `flutter/pubspec.yaml` — Flutter dev dependencies
- `docs/audits/` — Historical test audits (2026-06-27, 2026-06-28)
