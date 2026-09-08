# Audit: Workflow Section (+ fix plan)

**Date:** 2026-09-08
**Scope:** Flutter `features/workflows/` (hub) → app router (`app_state.dart`,
`router.dart`, `router_body.dart`), lifecycle gate, offline queue → web state
machines (rider, rental, transaction, deposit, guarantor, ticket, incident,
KYC, vehicle) + RBAC/audit/cache/idempotency governors → Prisma enums →
`flutter/test` + `web/tests` coverage.
**Method:** source-only (no docs read). All refs verified live in code.

**What "workflow" is:** Flutter `features/workflows/` is a single QA/debug hub
(`rider_workflow_hub_screen.dart`, 344 lines, 23 tiles, all
`AppNavigator.push`); the real journey lives in the router state machine
(`AuthState` + `RiderLifecycleGate.redirect` + `router_body.dart`). Web side is
8 server state machines plus admin screens and governors.

---

## Findings

### P1

#### P1-1 · Hub has zero lifecycle gating; form screens have no self-guard
- `rider_workflow_hub_screen.dart:33-117` — every tile pushes with no
  suspended/terminated check (verified: no `_canOpenRental` or equivalent
  exists in the file; `ref` is used only for `riderId`, line 38).
- Detail screens self-pop via `ref.listen(riderProvider)` +
  `RiderLifecycleGate.redirect` (the `rental_details_screen.dart:43-53`
  pattern), but the **form** screens reachable from the hub —
  `UserOnboardingScreen`, `GuarantorOnboardingScreen`, `ChoosePlanScreen`,
  `TopUpFlow` — carry no such guard. A suspended rider can fill out and
  submit forms that the server 409s (wasted effort) or, where no lifecycle
  check exists on the write path, partially accepts.
- Note the asymmetry: pushed *detail* screens are protected, pushed *forms*
  are not, and the hub (their only non-router entry) checks nothing.

#### P1-2 · Hub breaks the onboarding chain
- Router wires `choosePlan→topUpAmount` and `guarantor→choosePlan`
  (`router_body.dart:303-348`); hub tiles pass
  `onNext: () => Navigator.maybePop(context)` (`hub:88-93`, `:104-109`),
  so a mid-onboarding rider finishing Choose-plan via hub lands back on the
  hub with no forward step. Same for the Guarantor tile.

#### P1-3 · Incident machine allows statuses Prisma can't store
- Machine permits `REPORTED`/`DISMISSED` (`incident-state-machine.ts:9-16`);
  `IncidentStatus` has only `OPEN/INVESTIGATING/RESOLVED/CLOSED`
  (`schema.prisma:1786-1793`). `updateIncident` validates via machine *then*
  writes (`incident.use-cases.ts:213-233`).
- Mitigating fact (verified): route zod `updateIncidentSchema` restricts
  status to the 4 Prisma values (`validators.ts:814-821`), and `create()`
  never sets status (DB default `OPEN`), so the divergence is **latent** —
  reachable only by direct use-case callers or a future UI addition. Fix by
  trimming the machine (no migration), not by adding dead enum values.

#### P1-4 · Rental machine contains a state the DB rejects
- `DEPOSIT_APPROVED` is in `rental-state-machine.ts:15,34` but absent from
  Prisma `RentalStatus` (`schema.prisma:1589-1600`). Verified read-only today:
  `rental.repository.ts:72,104,160` only ever validates *toward*
  `PLAN_SELECTED`/`ACTIVE`/`RETURN_PENDING`. One future `executeLeaseAction`
  edge using it becomes a runtime 500.

#### P1-5 · `CANCELLED` transactions fall out of the machine
- Prisma added `CANCELLED` (rider-changed-mind, `schema.prisma:1547-1561`);
  `transaction-state-machine.ts:22-29` has no entry and the TS union
  (`:12-18`) omits it. Consequences: `VALID_TRANSITIONS[current]` is
  `undefined` for such rows (error text degrades to "Allowed: none"),
  `canTransitionTransaction` is false for everything (correct outcome, wrong
  reason), and the type system can't even name the state. `api-handler.ts:83-90`
  maps typed state errors to 409 — an unlisted state risks falling through to
  the generic 500 path (`:96`).

### P2

- **Hub TopUpFlow diverges from router flow.** Hub pushes bare `TopUpFlow()`
  (`hub:115`), defaulting ₹2000 (`top_up_flow.dart:37-42`); router drives the
  amount via `topUpFlowProvider`, branches `SECURITY_DEPOSIT` vs `TOP_UP` on
  `_isOnboarding`, and lands on a receipt screen (`router_body.dart:590-699`;
  client sends only a purpose *hint*, server rank rule decides —
  `top_up_flow.dart:119-147`). A hub top-up during onboarding can file TOP_UP
  where the router would file SECURITY_DEPOSIT (analytics/receipt diverge;
  money itself is saved by the server rule).
- **`HistoryScreen(riderId: 'local')` fallback** (`hub:38`). Harmless today
  (screen refreshes via `riderProvider`), but a literal `'local'` id in a
  history query is a landmine if the param is ever used for fetch.
- **Guarantor `REPLACED` comment lies.** Header says terminal; table re-opens
  (`REPLACED: ['SUBMITTED']`, `guarantor-state-machine.ts:21-28`). Behavior
  looks intended — fix the comment.
- **Vehicle machine has no terminal** (`RETIRED`/`LOST` cycle back). Plausibly
  intentional (reactivation); confirm deliberate or add `SCRAPPED`. Ops call.
- **Ticket `revert` bypasses the machine by design**
  (`support.use-cases.ts:445-457`, audited + `ticket.bulk_revert`). Acceptable,
  but CLOSED-is-terminal is then advisory — keep audit-trail review in the
  ops runbook.
- **`riders_delete: []`** — nobody holds direct delete (request/approve/recover
  flow instead). Correct posture; confirming intentional, not misconfig.
- **Incident `validateIncidentTransition` throws generic `Error`**, while all
  sibling machines throw typed `*StateError` mapped to 409 in
  `api-handler.ts:83-90`. A machine violation here surfaces as a generic 500
  (`api-handler.ts:96`).
- **`INC-${Date.now()}` incident ids** (`incident.use-cases.ts:114`) sit under
  a `@unique` constraint (`schema.prisma:1059`) — concurrent SOS bursts can
  P2002. Append 4 random hex chars (the ticket-id pattern in
  `support.use-cases.ts`).

### Verified good (no action)

Router lifecycle mapping, `PopScope`/`_canPop`/`_handleSystemBack` coverage,
CAS guards (`transitionRiderStatus`, lease/vehicle atomic claims), hub
offline behavior per screen (pickup hard-blocks offline, tickets queue
text-only, KYC banners + local draft), per-ticket bulk validation with
skip-counts, RBAC matrices, audit-log critical-write throwing, idempotency on
money/bulk routes, pickup draft revalidation, offline queue ordering
(stop-on-first-failure), FCM `SUPPORT_REPLY` refresh, route-level zod on the
incident write path (what keeps P1-3 latent rather than live).

---

## Fix plan

Conventions: `flutter/` and `web/` roots as prefixed. Run `flutter analyze`
on touched files and `npm run typecheck && npm run lint` in `web/` after every
phase. No migrations required for any item (P1-3 goes the trim-machine route).

### Phase 0 — Safety baseline (15 min)

1. `git checkout -b fix/workflow-audit-2026-09-08` (tree is dirty — branch first).
2. Baseline greens to record:
   - `flutter test test/workflows/ test/app/router_pickup_draft_test.dart
     test/features/auth/rider_lifecycle_gate_test.dart` (note: if
     `router_pickup_draft_test.dart` fails to compile on unrelated
     `vehicle_photos_screen.dart` theme drift, record it as pre-existing and
     exclude it from the gate).
   - `npx vitest --run tests/unit/state-machines.test.ts
     tests/unit/server/use-cases/completePickupVerification.test.ts`
     in `web/`.

### Phase 1 — P1-1: shared lifecycle guard (1h)

1. New `flutter/lib/widgets/lifecycle_route_guard.dart`:
   - `bool isLifecycleBlocked(RiderModel? rider)` → true when
     `RiderLifecycleGate.redirect(rider)` is `suspended`/`terminated`
     (null rider → false; loading state must not pop).
   - `mixin LifecycleRouteGuard<T extends StatefulWidget> on State<T>` (or a
     `ConsumerState` variant matching the codebase's Riverpod v3 style) that
     calls `ref.listen(riderProvider, …)` in `build` and pops when blocked —
     the exact 6-line pattern already proven in the three detail screens.
   - `Future<bool> guardHubPush(WidgetRef ref, BuildContext context)` helper:
     shows the `Account unavailable…` toast and returns false when blocked.
2. Apply the mixin to `UserOnboardingScreen`, `GuarantorOnboardingScreen`,
   `ChoosePlanScreen`, `TopUpFlow` (4 small diffs, no behavior change on the
   happy path).
3. Hub: wrap all 23 tile `onTap`s (or better, wrap `AppNavigator.push` in a
   hub-local `_guardedPush`) with `guardHubPush`.
4. Tests (`test/workflows/lifecycle_guard_test.dart`, new): suspended rider +
   hub tile tap → toast, no push; suspended rider on guarded form → auto-pop;
   null rider → no pop. Existing `rider_lifecycle_gate_test.dart` covers the
   redirect matrix already — reuse its seeds.

**Risk:** low (additive guards; the pop only fires on terminal states).
**Verify:** manual — suspend a dev rider mid-form, confirm auto-pop to the
router's terminal surface.

### Phase 2 — P1-3 + P1-4 + P1-5: machine/DB alignment (45 min total)

1. **P1-3** (`incident-state-machine.ts`): delete `REPORTED`/`DISMISSED` from
   the union + transition table (they are unwritable: zod blocks them,
   `create()` never sets them). Keep them out of Prisma — no migration.
   Add a comment pointing at `validators.ts:814-821` as the write-path
   allowlist so the next author extends both together. Update
   `state-machines.test.ts` if it enumerates incident states.
2. **P1-4** (`rental-state-machine.ts`): annotate `DEPOSIT_APPROVED` as
   read-only (rider-lifecycle comparison only — never a lease write target),
   or delete the entry after grepping all `validateRentalTransition` callers
   for it (verified: only toward PLAN_SELECTED/ACTIVE/RETURN_PENDING today).
   Prefer annotation (zero behavior change).
3. **P1-5** (`transaction-state-machine.ts`): add `'CANCELLED'` to the union +
   `CANCELLED: []` with a terminal comment (matches the Prisma comment's
   semantics). Add unit test: `canTransitionTransaction(CANCELLED, APPROVED)
   === false`; `validateTransactionTransition` throws `TransactionStateError`
   (→409 via api-handler), never 500.

### Phase 3 — P1-2 + P2 Flutter batch (~1.5h)

1. **Hub forward navigation:** `ChoosePlanScreen(onNext: …)` → push
   `TopUpFlow(initialAmount: chosenAmount)` instead of `maybePop`; Guarantor
   tile `onNext` → push `ChoosePlanScreen` (mirroring `router_body.dart`
   order). Keep `maybePop` as fallback when `pickupDone` (post-onboarding
   QA use). Test: seeded onboarding rider completes hub choose-plan → lands
   on top-up, not hub.
2. **TopUp parity:** hub TopUp tile reads `topUpFlowProvider.amount` for
   `initialAmount`; after hub-flow success, push the receipt screen the same
   way the router does (extract the router's receipt construction if it's
   inline) instead of pop+toast. Confirm server purpose still governs
   analytics (already does — `top_up_flow.dart:143-147`).
3. **`'local'` fallback:** hub passes `riderId` through and `HistoryScreen`
   asserts non-empty (toast + pop when null) instead of defaulting to
   `'local'`.
4. **Guarantor comment:** one-line fix (`REPLACED` re-opens by design).

### Phase 4 — P2 web batch (~45 min)

1. `IncidentStateError` class (message/current/target, following the
   `RentalStateError` shape), use in `validateIncidentTransition`, add to the
   `api-handler.ts:83-90` instanceof chain → 409s instead of 500s. Test.
2. `incidentId`: `` `INC-${Date.now()}-${randomHex(4)}` `` (ticket-id precedent).
3. Ops-runbook notes (no code): vehicle-machine terminal decision, ticket
   `CLOSED`-resurrection review, `riders_delete: []` intentional.

### Verification matrix

| Gate | Command / check |
|---|---|
| Analyze + types + lint | `flutter analyze` (touched files); `npm run typecheck && npm run lint` in `web/` |
| Unit | new guard test + machine tests (`state-machines`, pickup verification, transaction service) |
| Widget | hub forward-nav test with seeded onboarding rider; existing `rider_workflow_hub_screen_comprehensive_test.dart` still green |
| Manual (dev) | suspend mid-form → auto-pop; hub tile while suspended → toast, no push; incident update with bad status → 422 (zod) unchanged |
| Coverage | no drop vs Phase-0 baseline |

**Total: ~4.5–5h across 4 phases**, each independently shippable (Phase 1+2 are the safety core).
