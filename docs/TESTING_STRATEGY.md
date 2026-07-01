# Voltium Testing Strategy

## 1. Scope
This document outlines the testing strategy for the Voltium platform. 
- **In Scope**: Web frontend and backend logic, Flutter rider application, API integration, E2E admin testing, Golden visual baselines.
- **Out of Scope**: Third-party payment gateway internals, arbitrary hardware testing.

## 2. Exclusion List
The following paths and file types are excluded from coverage calculations:
- Generated code (`src/generated/**`, `*.g.dart`, `*.freezed.dart`)
- Mocks (`src/**/__mocks__/**`)
- Type definitions (`src/**/*.d.ts`, `src/**/types.ts`)
- Configuration files (`src/**/*.config.ts`)
- OpenAPI/Prisma contracts (`src/contracts/**`)

## 3. Coverage Thresholds
We strictly enforce coverage thresholds via CI gates.
- **Web**: 85% lines, 75% branches, 85% functions, 85% statements.
- **Flutter**: 80% lines, 70% branches, 80% functions, 80% statements.
- **New Code**: 95% lines, 90% branches, 95% functions, 95% statements (diff requirement).

## 4. Test Pyramid
We aim for the following test distribution to balance speed and confidence:
- **60% Unit Tests**: Fast, isolated, validating business logic edges (Zod schemas, algorithms).
- **30% Integration Tests**: DB connectivity, API boundary tests, authentication workflows.
- **10% E2E Tests**: Playwright admin tests, Flutter E2E journeys on emulators.

## 5. Naming Conventions
- Web Unit/Integration: `*.test.ts`
- Web Workers: `*.job.test.ts`
- Flutter Unit/Widget: `*_test.dart`
- Web E2E (Playwright): `*.spec.ts`

## 6. Golden Test Workflow
Visual regression testing for Flutter ensures exact layout match.
- **How to add**: Use `testWidgets` and `matchesGoldenFile()` for screens/widgets in `test/widgets/` or `test/features/*/presentation/`.
- **Updating**: Run `flutter test --update-goldens` locally if deliberate visual changes are made.
- **PR Requirement**: Any changes to `.png` golden baseline files require explicit design review.

## 7. Per-Feature Test Files
Tests must be co-located with their features logically:
- **Web**: `tests/unit/`, `tests/integration/`
- **Flutter**: `test/features/<feature_name>/data/`, `test/features/<feature_name>/presentation/`

## 8. Mocking Strategy
- **Money Paths**: Always use **Real PostgreSQL** (via local DB or testcontainers) for `wallet`, `rental`, and `transaction` features to ensure atomic safety and row-locking logic.
- **Non-Money Paths**: Use Prisma mocks (`mockDeep<PrismaClient>()`) or `mocktail` for Flutter repositories to optimize test speeds.
- **Time/Clock**: Use explicit Clock dependency injection (`startWorkers(mockClock)`) for worker orchestrators and scheduled loops, combined with the global `clock.set()` interceptor for `JobQueue` to enable deterministic testing of exponential backoffs and cron timers without real-time delays.

## 9. CI Matrix
Tests are run against the following standardized matrix:
- **Node Version**: v20
- **Flutter Version**: 3.22.x+
- **OS**: Ubuntu-latest (linux) for backend/flutter-unit, macOS/Android for E2E device tests.

## 10. Local Commands
**Quick Reference Card:**
- `npm run test:unit` — Run fast web unit tests.
- `npm run test:api` — Run comprehensive web API tests.
- `npm run test:coverage` — Web unit tests + generate coverage reports.
- `npm run test:e2e` — Run Playwright admin E2E tests.
- `flutter test` — Run all Flutter unit and widget tests.
- `flutter test --coverage` — Generate Flutter coverage report (`coverage/lcov.info`).
- `flutter test --update-goldens` — Re-generate visual baselines.
