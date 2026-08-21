# Voltium Rider App — Full Implementation Plan (2026-08-21)

**Scope:** Fix every still-live item from the 2026-07-08 audit + the 2026-08-21 delta.
**Companion docs:** `AUDIT_DELTA_2026-08-21.md` (the audit itself) and `IMPLEMENTATION_PLAN_2026-08-21.md` (the ship-it-now list — Phase 1 below).
**Method:** 14 PR-sized chunks in 3 tiers. Honest about cost. Phase 1 ships first; Phases 2/3 are your call.

---

## Status (2026-08-21)

Phase 1 (PR-1..5), Phase 2 Tier 1 (PR-6..9), and Phase 2 Tier 2
(PR-10..12) are **all shipped** on
`fix/consolidated-audit-fixes-2026-08-16`:

| PR | Title | Commit |
|---|---|---|
| 1 | `isNewRider` default → `true` | `90d7190d` |
| 2 | Drop `provider` package from pubspec | `90d7190d` |
| 3 | Delete `AppProvider` shim | `90d7190d` |
| 4 | Full en+hi translation sweep | `c59c6213`, `747e1f11` |
| 5 | Dark-mode coverage audit | `5564c085`, `60e8f632` |
| 6 | Reconcile permissions UI vs router gating | `f977a16a` |
| 7 | Move `AppShell` to its own file | `1762904a` |
| 8 | Finalize the provider migration | `ada10ca3` |
| 9 | Top-up flow state → Riverpod | `bb25c60a` |
| 10 | Deep dark-mode coverage + visible focus indicators | `15f2954` |
| 11 | Telemetry consolidation | `597ce51` |
| 12 | FCM command secret robustness audit | `de5e4199` |

Tier 3 (PR-13..14) remains deferred past release per the
2026-08-21 product call.

---

## How to read this plan

The original audit and the focused 5-PR plan covered the highest-value items. This file is **everything else**, organized in 3 tiers:

- **Phase 1 (ship now)** — high value, low/medium risk. Already documented in `IMPLEMENTATION_PLAN_2026-08-21.md`. PR-1..5.
- **Phase 2 Tier 1 (ship soon)** — small, high-leverage cleanups. Each is a half-day to 1-day PR. PR-6..9.
- **Phase 2 Tier 2 (consider)** — medium-cost cleanups with clear value. Each is a 1–3 day PR. PR-10..12.
- **Phase 2 Tier 3 (only if you want)** — large architectural refactors. Multi-day to multi-week. PR-13..14.

Each PR has the same shape as in the focused plan: **what the rider sees / why now / files / acceptance criteria / out of scope / risk**.

---

## Phase 1 — Ship now (PR-1..5)

See `IMPLEMENTATION_PLAN_2026-08-21.md` for full detail. Summary:

| PR | Title | Risk | Time |
|---|---|---|---|
| 1 | `isNewRider` default → `true` | Tiny | ~2 hrs |
| 2 | Drop `provider` package from pubspec | Tiny | ~30 min |
| 3 | Delete `AppProvider` shim | Medium | ~1 day |
| 4 | Full en+hi translation sweep (hardcoded English → ARB, both languages) | Low | ~2–3 days |
| 5 | Dark-mode coverage audit (canonical use of `AppColors.of(context)`) | Low | ~1 day |

**Phase 1 total:** ~5–6 days.

---

## Phase 2 Tier 1 — Ship soon (PR-6..9)

Small, high-leverage cleanups. Each one is a single, self-contained PR.

### PR-6 — Reconcile permissions UI vs router gating (F-003/4)

**What the rider sees:**
- **Before:** Permissions screen advertises phone + call_log as required, but the router only gates on location + camera + notifications. A rider can skip past the screen without granting phone/call_log.
- **After:** Either (a) the router actually requires phone+call_log before advancing past the permissions wall, or (b) the permissions UI drops them from the "required" list (with a small note that they're optional). Since call_log and contacts stay (per your direction), option (a) is the consistent answer.

**Why now:** The inconsistency is a real UX bug — riders see "X is required" but the app doesn't enforce it. Either commit to the requirement or drop the copy.

**Files touched:**
- `lib/app/router.dart` (`_areAllRequiredPermissionsGranted` adds `Permission.phone.status` and the call-log check; or `permissions_screen.dart` removes them)
- `lib/features/onboarding/presentation/screens/permissions_screen.dart` (UI text)
- `lib/services/device_data_service.dart` (no functional change; verify gating on phone permission before sync)

**Acceptance criteria:**
- [ ] Whichever option is chosen, UI and gating are consistent.
- [ ] `flutter test` green; integration test 03 (permissions) still passes.
- [ ] **Device: fresh install, deny phone on the permissions screen, verify the rider cannot proceed until granted (option a) — or the screen doesn't claim it's required (option b).**

**Decision needed:** option (a) enforce, or (b) drop from required? My rec: **(a) enforce** because the device-data sync already depends on phone permission being granted; pretending it's optional is just lying.

**Risk:** Low.

### PR-7 — Move `AppShell` to its own file (N5)

**What the rider sees:** Nothing. Slightly cleaner import graph.

**Why now:** `lib/app/router.dart:21` has `import '../main.dart' show AppShell;` — that's a backwards import direction. `main.dart` constructs providers, then `router.dart` imports back to grab the shell widget. Works fine, but the import direction is wrong; future contributors will be confused.

**Files touched:**
- `lib/widgets/app_shell.dart` (new file, holds `AppShell` widget)
- `lib/app/router.dart` (replace the `main.dart` import with the new path)
- `lib/main.dart` (remove the `AppShell` class)

**Acceptance criteria:**
- [ ] `flutter analyze` clean.
- [ ] `flutter test` + integration tests green.
- [ ] No `import '../main.dart'` from anywhere except main itself.

**Risk:** Tiny. Mechanical move.

### PR-8 — Finalize the provider migration (N3)

**What the rider sees:** Nothing. Slightly faster app startup (one fewer legacy constructor chain at boot).

**Why now:** PR-3 deletes the `AppProvider` shim, but the 3 lines in `app_provider.dart:109-111`:
```dart
engagementProvider = engagementProvider ?? EngagementProvider(),
devicePolicyProvider = devicePolicyProvider ?? DevicePolicyProvider(),
connectivityProvider = connectivityProvider ?? ConnectivityProvider(),
```
…construct three providers via legacy default constructors. The other four (rider, wallet, support) are already Riverpod. This PR migrates these last three.

**Files touched:**
- `lib/features/dashboard/presentation/providers/engagement_provider.dart` (convert to `Notifier<EngagementState>`)
- `lib/features/device_compliance/presentation/providers/device_policy_provider.dart` (same)
- `lib/core/network/connectivity_provider.dart` (same)
- All call sites that currently `EngagementProvider()` (one-off construction) → switch to `ref.read(engagementProvider.notifier)`
- `lib/main.dart` (remove the legacy constructor calls in `ProviderScope.overrides`)

**Acceptance criteria:**
- [ ] No `new EngagementProvider()` / `new DevicePolicyProvider()` / `new ConnectivityProvider()` outside the Riverpod definitions.
- [ ] `flutter analyze` clean.
- [ ] `flutter test` + integration tests green.

**Risk:** Medium. Touches the main bootstrap path. PR-3 first is a prerequisite.

### PR-9 — Move top-up flow state from router constructor fields to a Riverpod provider (audit deferred item)

**What the rider sees:**
- **Before:** Top-up flow state (amount, receipt, screenshot URL) is held in private fields on `AppRouterState` and passed between 6 screens via constructor parameters. If a rider backs out and re-enters, all state is lost. A backgrounded app can lose it too.
- **After:** The state lives in a Riverpod `topUpFlowProvider`. Re-entering the flow resumes where the rider left off; the screens are dumb.

**Why now:** The audit flagged this as brittle. With the Riverpod migration complete, there's a clean home for this state.

**Files touched:**
- New: `lib/features/wallet/presentation/providers/top_up_flow_provider.dart`
- `lib/app/router.dart` (remove `_topUpAmount` and related fields; reads from provider instead)
- All 6 top-up screens (`top_up_purpose`, `top_up_amount`, `top_up_upi`, `top_up_proof`, `top_up_receipt`) — switch constructor params to `ref.watch(topUpFlowProvider)`
- Tests for top-up flow

**Acceptance criteria:**
- [ ] Backing out of the flow and re-entering resumes the same `amount` and step.
- [ ] `flutter analyze` clean.
- [ ] `flutter test` + integration test 12 (wallet topup) green.
- [ ] **Device: start a top-up, enter amount 1500, back out, re-enter from pre-dashboard — confirm amount is still 1500.**

**Risk:** Medium. Refactor across 6 screens. Cover with integration test 12.

---

## Phase 2 Tier 2 — Consider (PR-10..12)

Medium-cost cleanups. Each has clear value but takes 1–3 days. Worth doing in the 2-month window if you want a cleaner codebase at release.

### PR-10 — Deep dark-mode coverage (extends PR-5)

**What the rider sees:** Same as PR-5, but more thorough. Catches edge cases PR-5 misses.

**Why now:** PR-5 fixes the obvious stragglers (widgets using `AppColors.surface` directly). This PR does a full audit + adds the focus-indicator fix the original 2026-07-08 audit flagged:

> "input borders set `borderSide: BorderSide.none` in all states — there is no visible focus indicator on any text field, an accessibility concern (WCAG 2.1 SC 1.4.13, 2.4.7)."

**Files touched:**
- Audit pass: enumerate every static `AppColors.X` reference where `X` has a light/dark variant
- `lib/theme/app_theme.dart` input border theme — add visible focus state
- Any widget that reads `AppColors.surface` etc. directly without `AppColors.of(context)`

**Acceptance criteria:**
- [ ] Same as PR-5, plus: **device: with TalkBack enabled, tab through text fields — confirm a visible focus indicator appears.**
- [ ] All `AppColors.surface` / `onSurface` / `onSurfaceMuted` / `iconBackground` / `surfaceBright` / `surfaceSubtle` / `borderSubtle` references go through `AppColors.of(context).X`.
- [ ] WCAG 2.1 SC 1.4.13 (focus visible) and 2.4.7 (focus indicator) pass on the auth + KYC forms.

**Risk:** Low. Color + theme-only changes.

### PR-11 — Telemetry consolidation (F-022)

**What the rider sees:** Nothing visible. Slightly smaller APK (one fewer SDK).

**Why now:** Three telemetry systems coexist:
- `posthog_flutter` (product analytics)
- `firebase_*` (Performance)
- `monitoring_service.dart` (custom logger that wraps the others)

The custom `monitoring_service` is the de-facto canonical interface (it wraps PostHog errors, has the structured logging), but the architectural layering is fuzzy. Pick one as "the logger" and document it.

**Files touched:**
- `lib/services/monitoring_service.dart` (add a doc block naming itself as the canonical logger)
- `lib/services/analytics_service.dart` (route all events through `monitoring_service` instead of calling `posthog_flutter` directly)
- `lib/services/performance_service.dart` (same for Firebase Performance)
- `docs/TELEMETRY.md` (new) — one-page doc: "We use PostHog for product analytics, Firebase Performance for app perf, and `monitoring_service.dart` as the only interface Flutter code should call."

**Acceptance criteria:**
- [ ] `grep -rn "PostHog\." lib/ | grep -v "posthog_service.dart\|monitoring_service.dart"` returns no hits.
- [ ] `grep -rn "FirebasePerformance\." lib/ | grep -v "performance_service.dart\|monitoring_service.dart"` returns no hits.
- [ ] `docs/TELEMETRY.md` exists and is the canonical reference.
- [ ] `flutter test` + integration tests green.

**Risk:** Low. Mostly routing + docs.

### PR-12 — FCM command secret robustness audit

**What the rider sees:**
- **Before:** A 401 on a /api/auth/* endpoint could, in some edge cases, leak through to the FCM command secret wipe path. The 2026-08-06 fix separated `clearSessionCredentials` from `clearAll`, but a full audit hasn't run.
- **After:** Every code path that touches `_storage.clearAll()` or `_storage.writeFcmCommandSecret()` is enumerated and verified to not leak across features.

**Why now:** This is a security-adjacent path. The 2026-08-06 fix was scoped; a full audit makes sure no other code path can drop the FCM command secret (which is used to verify `SECURITY_COMMAND` FCM messages like `ADMIN_LOCK`).

**Files touched:**
- `lib/services/secure_storage_service.dart` (audit every method; document the "preserved on logout" set)
- `lib/services/fcm_service.dart` (verify all FCM-secret-touching paths)
- `lib/core/network/api_client.dart` (verify refresh-token rejection doesn't touch FCM secret — PR-VER-2026-08-06 already fixed this; just verify)
- All `clearAll()` callers

**Acceptance criteria:**
- [ ] `grep -rn "clearAll" lib/` shows every caller and they all have a comment justifying why full-clear is needed.
- [ ] A test case: simulate logout, verify FCM command secret is still readable.
- [ ] **Device: receive an `ADMIN_LOCK` FCM after logout, verify the device can still HMAC-verify the payload.**

**Risk:** Low. Audit + tests, no behavior change.

---

## Phase 2 Tier 3 — Only if you really want (PR-13..14)

Large architectural refactors. Each is a multi-day to multi-week effort with significant blast radius. **Recommend deferring past the release window** unless you have a specific trigger.

### PR-13 — Delete `VoltiumApiService` (was optional in Phase 1)

**What the rider sees:** Nothing. Slightly faster compile times.

**Why now:** `VoltiumApiService` wraps `VoltiumApiClient` (the generated client) and converts typed responses back to `Map<String, dynamic>` via `response.toJson()`. The generated client is the source of truth; the wrapper discards type safety.

**Files touched:**
- `lib/services/voltium_api_service.dart` (delete)
- All callers (`grep -rn "VoltiumApiService" lib/`) — likely 10–15 files
- Test mocks that target `VoltiumApiService`
- Repository classes that bridge between generated client and features — may need consolidation

**Acceptance criteria:**
- [ ] `grep -rn "VoltiumApiService" lib/ test/` returns nothing.
- [ ] All repositories return typed models, not maps.
- [ ] `flutter test` + integration tests green.

**Risk:** **High.** Touches many call sites. Possible 1–2 days if you avoid scope creep; 1 week if you also consolidate the repository layer.

### PR-14 — Full DI refactor (F-025)

**What the rider sees:** Nothing. Slightly faster tests.

**Why now:** `ApiClient` is a static singleton with a test seam; `SecureStorageService` is a singleton; `RiderRepository`, `WalletRepository`, etc. are constructed with manual DI. The codebase would be cleaner with a single `ProviderContainer` injecting everything.

**Files touched:**
- `lib/core/network/api_client.dart` (replace static factory with Riverpod provider)
- `lib/services/secure_storage_service.dart` (same)
- `lib/core/state/riverpod_providers.dart` (add the new providers)
- Every call site that does `ApiClient()` (probably 30+)
- Every test that constructs services manually (probably 50+ files)

**Acceptance criteria:**
- [ ] `grep -rn "ApiClient()" lib/ | grep -v "factory ApiClient"` returns nothing.
- [ ] `grep -rn "static.*_instance" lib/services/` returns nothing.
- [ ] All tests run with `ProviderContainer` overrides only.
- [ ] `flutter test` + integration tests green.

**Risk:** **Very high.** This is a full architectural refactor. Realistically 1–2 weeks. The current `instanceForTest` seam already works for tests; the value of doing this is mainly code aesthetics.

---

## Recommended ordering (everything in priority order)

If I had to ship all of this, here's the order I'd do:

| Order | PR | Tier | Why in this order |
|---|---|---|---|
| 1 | PR-1 isNewRider | Phase 1 | Correctness. ~2 hrs. |
| 2 | PR-2 drop provider | Phase 1 | No-op prerequisite for PR-3. |
| 3 | PR-6 permissions reconcile | Tier 1 | Quick UX win; can run parallel to PR-3. |
| 4 | PR-7 AppShell import | Tier 1 | Trivial. Do while waiting for PR-3 review. |
| 5 | PR-3 delete AppProvider | Phase 1 | Prerequisite for PR-8. |
| 6 | PR-8 finalize provider migration | Tier 1 | Closes the original Riverpod migration. |
| 7 | PR-4 en+hi translation sweep | Phase 1 | Largest Phase 1 PR. Run while device QA on prior PRs. |
| 8 | PR-9 top-up flow state | Tier 1 | Architectural improvement. ~1 day. |
| 9 | PR-5 dark-mode audit | Phase 1 | Boring; bundle with PR-10 if you want. |
| 10 | PR-10 deep dark mode + focus | Tier 2 | Bundle with PR-5 for one QA pass. |
| 11 | PR-12 FCM secret audit | Tier 2 | Security hygiene. ~1 day. |
| 12 | PR-11 telemetry consolidation | Tier 2 | Doc + routing. ~1 day. |
| 13 | PR-13 delete VoltiumApiService | Tier 3 | Big. Schedule for a slow week. |
| 14 | PR-14 full DI refactor | Tier 3 | Defer past release unless triggered. |

**Grand total:** ~3–4 weeks of focused work for everything. Release-window friendly: Phase 1 + Tier 1 in ~10 working days.

---

## What I'm explicitly NOT planning to do

To be honest about scope:

- **Server-side changes** (e.g. make `isNewRider` a required field). Those are out of scope for a Flutter-only plan; open a server ticket if you want me to add the schema guard.
- **Web app work.** This is Flutter-only; the web app has its own plan and audit.
- **Firebase / PostHog migration off the platforms entirely.** The telemetry consolidation (PR-11) is about Flutter-side routing, not vendor change.
- **Adding a third language.** Per the rule, en+hi only.
- **Reverting PR-VER-2026-08-06 or any other previously-shipped security fix.** Those are stable.

---

## Open questions for you

Before I start Phase 1, two clarifications:

1. **PR-6 (permissions reconcile):** option (a) enforce phone/call_log, or (b) drop from required? My rec is (a).

2. **Do you want to commit to Tier 3 (PR-13, PR-14)?** Those are large refactors. If "no, defer past release" is the answer, that's a fine answer — I'll just stop at Tier 2 and document the deferral in the audit. If "yes, work them in over the next month," I'll add them to the schedule.

Default answers if you don't reply: **(a) enforce; (b) defer past release, work only Tier 1 + Tier 2.**
