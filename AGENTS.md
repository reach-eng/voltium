# Agent Context for Voltium

This file contains context for AI assistants working on this codebase.

## Key Commands

| Command             | Description                   |
| ------------------- | ----------------------------- |
| `npm run dev`       | Start dev server on port 8081 |
| `npm run build`     | Production build              |
| `npm run typecheck` | TypeScript validation         |
| `npm run test:unit` | Unit tests only               |
| `npm run lint`      | ESLint                        |
| `npm run db:push`   | Update database schema        |

## Important Libraries

- **Database**: Prisma with PostgreSQL
- **Validation**: Zod (`src/lib/validators.ts`)
- **Error Handling**: `src/lib/api-error.ts`
- **Response Format**: `src/lib/api-response.ts`
- **Caching**: `src/lib/cache.ts`

## Key Constants

- Config in `src/lib/config.ts`
- Screen registry in `src/app/page.tsx`

## Common Issues

- **Missing imports**: Check `src/lib/` for shared utilities
- **Validation errors**: Use `validateBody()` helper from validators.ts
- **API errors**: Use `errors.badRequest()`, `errors.unauthorized()`, etc.
- **Response format**: Always use `success()` or `error()` helpers

## Database

- Schema: `prisma/schema.prisma`
- Client: `src/lib/db.ts`
- Indexes added for: Rider, Transaction, Vehicle

## Testing

### Backend Unit Tests

- Location: `tests/unit/`
- Run: `npm run test:unit`

### Flutter E2E Tests (33/33 PASSING)

- Location: `flutter/integration_test/e2e_individual/`
- Run all: `bash flutter/integration_test/e2e_individual/run_phased_tests.sh emulator-5554`
- Run single: `flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/XX_test_name.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true`

#### Test Inventory (33 files)

| #   | File                                      | Category       |
| --- | ----------------------------------------- | -------------- |
| 00  | `00_diagnostic_test.dart`                 | Diagnostic     |
| 01  | `01_splash_screen_test.dart`              | Splash         |
| 02  | `02_legal_screen_test.dart`               | Legal          |
| 03  | `03_permissions_screen_test.dart`         | Permissions    |
| 04  | `04_login_screen_test.dart`               | Login          |
| 05  | `05_otp_verification_test.dart`           | OTP            |
| 06  | `06_full_auth_login_test.dart`            | Full Auth      |
| 07  | `07_dashboard_elements_test.dart`         | Dashboard      |
| 08  | `08_dashboard_navigation_test.dart`       | Navigation     |
| 09  | `09_notifications_test.dart`              | Notifications  |
| 10  | `10_referral_widget_test.dart`            | Referral       |
| 11  | `11_wallet_balance_test.dart`             | Wallet         |
| 12  | `12_wallet_topup_test.dart`               | Wallet Top-up  |
| 13  | `13_wallet_filters_test.dart`             | Wallet Filters |
| 14  | `14_profile_display_test.dart`            | Profile        |
| 15  | `15_profile_edit_test.dart`               | Profile Edit   |
| 16  | `16_profile_kyc_status_test.dart`         | KYC Status     |
| 17  | `17_otp_resend_test.dart`                 | OTP Resend     |
| 18  | `18_otp_back_button_test.dart`            | OTP Back       |
| 19  | `19_logout_test.dart`                     | Logout         |
| 20  | `20_support_screen_test.dart`             | Support        |
| 21  | `21_support_faq_test.dart`                | FAQ            |
| 22  | `22_support_chat_test.dart`               | Chat           |
| 23  | `23_support_ticket_test.dart`             | Ticket         |
| 24  | `24_settings_screen_test.dart`            | Settings       |
| 25  | `25_settings_theme_toggle_test.dart`      | Theme          |
| 26  | `26_settings_biometric_toggle_test.dart`  | Biometric      |
| 27  | `27_missing_vehicle_state_test.dart`      | Edge Case      |
| 28  | `28_offline_indicator_test.dart`          | Offline        |
| 29  | `29_empty_referral_test.dart`             | Referral Edge  |
| 30  | `30_full_journey_test.dart`               | Full Journey   |
| 31  | `31_error_recovery_test.dart`             | Error Recovery |
| 32  | `32_rental_end_test.dart`                 | Rental         |
| 33  | `33_onboarding_referral_logout_test.dart` | Full Flow      |

#### Key Test Helpers (`flutter/integration_test/helpers/test_helpers.dart`)

- `launchApp(tester)` - Launches app, clears state, waits past splash
- `handlePreamble(tester)` - Handles auth choice, legal, permissions screens
- `completeAuthFlow(tester)` - Phone entry → OTP verification (uses scrollUntilVisible for buttons)
- `fullLoginFlow(tester)` - Complete journey: splash → auth → onboarding → dashboard
- `navigateToTab(tester, key)` - Bottom nav switching
- `expectOnDashboard(tester)` - Dashboard assertion
- `goBack(tester)` - Handles custom back buttons
- `setupReturningUser()` - Pre-seeds rider cache for returning user flow

#### Critical Test Fixes Applied

1. `behavior: HitTestBehavior.opaque` on `sendOtpButton` and `verifyOtpButton` - fixed tap detection
2. `scrollUntilVisible()` for buttons in scrollable views
3. `TEST_MODE` dart-define skips permissions screen
4. Assertions use `findsAtLeastNWidgets(1)` or text content checks instead of strict `findsOneWidget`
5. `await` on all async test APIs (e.g., `expectOnDashboard`)

## Build & Dev Scripts

### `.zscripts/` — Full-stack orchestration (CI/production)

| Script | Purpose |
|--------|---------|
| `dev.sh` | Start dev server + mini-services with health checks (uses `bun`) |
| `build.sh` | Full production build: Next.js standalone + mini-services + DB migration + tarball |
| `mini-services-install.sh` | Install dependencies for all `mini-services/` sub-projects |
| `mini-services-build.sh` | Build each mini-service into a standalone Bun bundle |
| `mini-services-start.sh` | Start all built mini-services in production |
| `start.sh` | Production entry point: Next.js standalone + mini-services + Caddy reverse proxy |

### `scripts/` — Utilities

| Script | Purpose |
|--------|---------|
| `db-sync.sh` | SQLite database backup/restore (`backup` / `restore` commands) |

## CI/CD

GitHub Actions: `.github/workflows/ci-cd.yml`

- Runs: lint → typecheck → build → test:unit

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
