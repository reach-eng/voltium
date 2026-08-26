# Detailed Plan — L-1 Permission Split, FL-12 Pinning Upgrade, Dormant Endpoints (2026-08-26)

**Parent:** `docs/PLAN_REMAINING_BACKLOG_2026-08-26.md` §9 "Out of Scope" — promoted to execution per team request.
**Branch:** continue on `fix/admin-finance-p0-2-p0-3-rowlock-bulk-2026-08-24`.
**Pre-flight gates (must be green before starting):** web typecheck/lint/346-file unit suite · flutter analyze/1654 tests · clean tree except known parallel-writer files.

---

## Item A — L-1b: Editor ≠ Publisher permission split for legal documents

### A.1 Current state (verified 2026-08-26)

| Fact | Evidence |
|---|---|
| Single permission today | descriptors: `{ key: 'legal_manage', label: 'Manage Legal', category: 'Admin' }` |
| Role grant | matrix line 127: `legal_manage: ['OPERATIONS_ADMIN']` |
| Save (PUT `/api/admin/legal`) gated on | `legal_manage` |
| **Publish** (POST `/api/admin/legal/[type]/publish`) gated on | **`legal_manage`** — `publish/route.ts:24` |
| Matrix typing (N-6 fix active) | `ROLE_PERMISSIONS: Readonly<Record<PermissionKey, RoleSet>>` at `permissions-roles.ts:28` — adding a new descriptor key makes tsc **require** a matrix row |
| UI publish button | `LegalManagement.tsx` renders unconditionally when `status === 'DRAFT'` |

**Gap:** any OPERATIONS_ADMIN who can edit terms can also silently publish them. The save→draft work (L-1 phase 1) made this two-step but not two-person.

### A.2 Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| New descriptor | `legal_publish` ("Publish Legal Documents", category `Admin`) | Follows existing verb-noun convention (`kyc_approve`, `rentals_book`) |
| Default role grant | **SUPER_ADMIN only** | Creates *real* separation today: OPERATIONS_ADMIN drafts, SUPER_ADMIN publishes. Delegation happens via the existing explicit-grant path (G-2 subset-of-granter rules apply) — no new mechanism needed |
| Save permission | unchanged (`legal_manage`) | Editors keep their workflow |
| Publish route gate | `legal_publish` (replaces `legal_manage`) | The whole point |
| UI gating | `useAdminSession()` → `session.permissions.includes('legal_publish')`; hide button when absent, show muted "Awaiting publisher approval" chip on DRAFT rows instead | Matches AdminSessionContext shape (`permissions: string[]`, verified `AdminSessionContext.tsx:14-15`) |
| Audit | unchanged — `legal.publish` action already records actor | Existing behavior sufficient |

### A.3 Tasks

| # | Task | File(s) | Acceptance |
|---|---|---|---|
| A-1 | Add descriptor `{ key: 'legal_publish', label: 'Publish Legal Documents', category: 'Admin' }` to `PERMISSION_DESCRIPTORS` | `web/src/lib/permissions-descriptors.ts` | tsc errors on missing matrix row (N-6 typing proves the safety net works) |
| A-2 | Add matrix row `legal_publish: ['SUPER_ADMIN']` | `web/src/lib/permissions-roles.ts` (~line 127, next to `legal_manage`) | tsc green again |
| A-3 | Publish route gate: `'legal_manage'` → `'legal_publish'`; update the route's doc-comment permission note (currently says "gated by legal_manage… follow-up if desired") | `web/src/app/api/admin/legal/[type]/publish/route.ts:24` | — |
| A-4 | Unit tests: (a) session with only `legal_manage` ⇒ POST publish returns 403; (b) SUPER_ADMIN ⇒ 200 + status PUBLISHED; (c) audit action `legal.publish` recorded with actor | extend `tests/unit/legal-lifecycle.test.ts` or new `tests/unit/legal-publish-perms.test.ts` mocking `@/lib/auth.hasPermission` like `financial-p0-routes.test.ts` does | 3 new tests pass |
| A-5 | Integration test addition: after PUT-save as OPERATIONS_ADMIN-fixture, GET `/api/rider/legal` must NOT contain sentinel until a SUPER_ADMIN publishes | `tests/integration/admin/legal.test.ts` — extend the existing L-1 describe block | passes in CI run with dev server |
| A-6 | UI: in `LegalManagement.tsx` read `const { session } = useAdminSession(); const canPublish = !!session?.permissions?.includes('legal_publish');` — render Publish button only when `canPublish && status==='DRAFT'`; when `!canPublish && status==='DRAFT'` render chip `Draft — awaiting publisher` | `LegalManagement.tsx` (button added in the F-017-era block near line ~170) | widget renders per role; no console errors |
| A-7 | Update `docs/TLS…` n/a — instead update the code comment in `publish/route.ts` and `legal.use-cases.publish()` JSDoc to reflect the new gate | those 2 files | comments match reality |

**A-effort:** ~0.5 day including tests.
**A-gate:** full web triple (typecheck/lint/unit) + targeted integration run.

---

## Item B — FL-12: CA-pin upgrade for TLS (SPKI-class hardening)

### B.1 Current state (verified)

`flutter/lib/core/network/pinned_http_client.dart`:
- Release builds throw unless pins exist (D-P0-1 fail-closed ✓)
- Pins compared in `badCertificateCallback` as SHA-256 over `cert.der` (base64 vs `TLS_PIN_SHA256`)
- `SecurityContext(withTrustedRoots: true)` → device trust store ⇒ **a valid chain from ANY public CA never reaches the callback** — trusted-CA misissuance MITM succeeds (the exact gap FL-12 flags)

### B.2 Why CA-trust-anchor pinning (not literal SPKI)

Dart's `HttpClient` exposes peer certificates **only** inside `badCertificateCallback`. There is no post-handshake API on success paths. Therefore true SPKI allow-listing is impossible client-side today. The practical equivalent:

> Restrict the `SecurityContext` trust anchors to Voltium's issuing CA bundle. Any chain not issued by those anchors fails validation outright — including valid chains from other public CAs.

Threat coverage delta: closes trusted-CA misissuance (the gap), keeps rogue-CA coverage from the existing hash layer.

### B.3 Design decisions

| Decision | Choice |
|---|---|
| Pin granularity | **Issuing intermediate CA** (not root, not leaf) — leaf pin breaks on every renewal; root pin over-trusts |
| Anchor source | Build-time assets: `flutter/assets/certs/voltium-ca.pem` (+ `.pem.next` during rotation windows). NOT dart-define (PEMs are multi-line; assets diff cleanly) |
| Trust mode switch | `--dart-define=TLS_PIN_MODE=ca\|hash\|off` — release default `ca`; `hash` preserves today's behavior for emergency rollback build; debug builds stay off |
| `badCertificateCallback` under `ca` mode | **always return false** (strict). No hash escape hatch — rotation is solved by dual-anchoring, not callback bypasses |
| Rotation | Dual-anchor window: ship `voltium-ca.pem` + `voltium-ca-next.pem` together for one release cycle before removing the old |
| Dynamic pins | `setDynamicPins()` retained for emergency server-driven pin push (existing mechanism, unchanged) |

### B.4 Tasks

| # | Task | File(s) | Notes |
|---|---|---|---|
| B-1 | Provision certs (external dependency — DevOps): export issuing-intermediate PEM(s) as base64 PEM; drop into `flutter/assets/certs/voltium-ca.pem` (+ next-window variant when known) | new asset dir | **Blocker for B-4 testing; B-2/B-3 can proceed with fixture PEMs (any self-signed test CA)** |
| B-2 | Extend `PinnedHttpInterceptor`: parse `TLS_PIN_MODE` (default `ca` in release, `off` in debug); in `ca` mode build `SecurityContext()..setTrustedCertificatesBytes(pemBytes)` with `withTrustedRoots:false`, attach all bundled PEMs; `badCertificateCallback => false` | `pinned_http_client.dart` | keep `createClient()` signature identical — zero caller churn (`api_client.dart:20` untouched) |
| B-3 | Keep `hash` mode implementation byte-for-byte as today's behavior behind the mode switch (rollback path) | same file | mode parsing unit-tested |
| B-4 | Unit tests: mode parsing defaults (debug→off, release→ca); missing asset in ca-mode ⇒ same loud StateError contract as D-P0-1; hash-mode still validates fingerprints | `test/core/network/pinned_http_client_test.dart` (new) | handshake itself can't be unit-tested — covered by runbook manual step |
| B-5 | pubspec: register `assets/certs/` | `pubspec.yaml` | — |
| B-6 | Manual MITM verification (runbook step): mitmproxy with a public CA cert ⇒ connection MUST fail in `ca`-mode release build; with voltium-chain cert ⇒ succeeds | runbook doc | record result in PR description |
| B-7 | Write `docs/TLS_PINNING_RUNBOOK.md`: anchor extraction commands (openssl), rotation dual-window procedure, dynamic-pin bootstrap, emergency `hash`-mode rollback build instructions, mitmproxy test recipe | new doc | reviewed by DevOps |
| B-8 | AGENTS.md build-command line update: add `--dart-define=TLS_PIN_MODE=ca` alongside existing `TLS_PIN_SHA256` example | `AGENTS.md` | keeps release recipe canonical |

**B-effort:** ~1 day (B-1 external wait may stretch wall-clock; code tasks are ~half day with fixture certs).

---

## Item C — Dormant endpoints: wire-or-delete decision

### C.1 Verified current state

| Endpoint | Generated client method | Feature callers | Server route | Data value |
|---|---|---|---|---|
| `/api/rider/pricing` | `getRiderPricing()` (`generated/api_client.dart:395`) | **0** | EXISTS — returns `toRupeesResponse({hub:{id,name}, availability, plans:[…]})` (hub-scoped plan pricing + availability) | Potentially useful: hub-aware plan availability that `getRiderPlans()` lacks |
| `/api/rider/settings` | `getRiderSettings()` (`:420`) | **0** feature callers; legacy wrapper `voltium_api_service.dart:208` also dead | EXISTS — returns settings map | Rider settings screen is **SharedPreferences-local only** (verified `settings_screen.dart:695,709`) |

### C.2 Decision (recommended)

| Endpoint | Verdict | Reasoning |
|---|---|---|
| `/api/rider/pricing` | **WIRE** | Hub-scoped availability is real signal ChoosePlanScreen lacks today (it lists global plans and lets riders pick unavailable ones). Wiring also de-risks the FL-17 follow-up (fee/config values eventually flow server-side). Server route already correct — zero backend work. |
| `/api/rider/settings` | **DELETE client surface now; server route → deprecation ticket** | No product requirement exists for server-synced rider prefs; screen is local-first by design; keeping an unused authenticated GET is attack-surface + maintenance noise. Full server-route removal touches OpenAPI contract (`contracts/openapi.ts`) — ticket it rather than half-delete. |

If product later wants server-synced prefs (multi-device theme/language), re-add via a purpose-built sync design — the deleted client method is trivially recoverable from git.

### C.3 Tasks — Wire pricing

| # | Task | File(s) | Acceptance |
|---|---|---|---|
| C-1 | Capture real envelope: hit `/api/rider/pricing` on dev, save JSON fixture to `test/fixtures/rider_pricing_envelope.json` | new fixture | matches `_handleResponse` unwrapped shape (map ⇒ unwrapped inner) |
| C-2 | `ChoosePlanScreen._fetchPlans`: after plans load, opportunistically `getRiderPricing()`; build `Map<String /*planId*/, {available: bool, hubName: String}>`; wrap in try/catch — pricing failure must NEVER block plan selection (graceful degrade to plans-only, current behavior) | `choose_plan_screen.dart:41-70` region | plans still render when pricing 500s |
| C-3 | UI affordance: badge per plan tile — `Available at {hubName}` (green) vs `Unavailable at your hub` (muted, tile disabled for subscribe tap) using availability flag | same screen, tile builder | disabled tile blocks `onSubscribe` |
| C-4 | Unit test: fixture envelope → tiles get availability; error-path test → plans-only fallback unchanged | `test/features/rentals/.../choose_plan_screen_test.dart` (extend or new) | 2–3 cases |
| C-5 | Remove `getRiderPricing`'s "dormant" annotation wherever noted; add `// WIRED (C-plan 2026-08-26)` comment | generated client is DO-NOT-MODIFY — annotate call site instead | — |

### C.4 Tasks — Delete settings client surface

| # | Task | File(s) | Acceptance |
|---|---|---|---|
| C-6 | Delete `getRiderSettings()` from generated client OR its callers-first check: grep confirms only `profile/data/repository_impl.dart:106` + dead `voltium_api_service.dart:208` reference it — delete method + the repository wrapper fn | `generated/api_client.dart`, `profile/data/repository_impl.dart` | `flutter analyze` 0 references remain (`grep -r getRiderSettings flutter/lib` → 0) |
| C-7 | Check `repository_impl` wrapper's consumers — if a provider calls it, redirect to local prefs (no network) | trace `grep -rn` from wrapper name | no orphaned UI state |
| C-8 | Ticket: `chore(api): remove /api/rider/settings route + OpenAPI entry` referencing `contracts/openapi.ts` — server-side deletion lands separately after one release soak | `docs/AUDIT_BACKLOG.md` new entry | ticket ID referenced in commit trailer |

---

## Sequencing

```
Item A (L-1b) ──── standalone, web only            [Day 1 AM]   0.5 d
Item C (endpoints) ─ flutter + 1 backlog ticket    [Day 1 PM]   0.5 d
Item B (FL-12) ──── code Day 2 AM w/ fixtures;     [Day 2]      1.0 d
                    manual MITM + runbook Day 2 PM
```

A and C touch disjoint repos/surfaces → parallelizable across two engineers. B's code tasks are independent of A/C entirely; only B-6 needs a built release APK.

## Gates (per item, before commit)

| Item | Gate |
|---|---|
| A | web typecheck + lint + full unit; new perm tests green; targeted integration (A-5) green with dev server |
| B | `flutter analyze` + full `flutter test`; new pinned-client tests green; B-6 manual evidence attached to PR |
| C | `flutter analyze` + full `flutter test`; choose_plan new tests green; C-8 ticket created |

## Definition of Done

- [ ] `legal_publish` exists, matrix-typed, granted SUPER_ADMIN only; publish route enforces it; OPERATIONS_ADMIN publish attempt ⇒ 403 (test-proven)
- [ ] LegalManagement hides publish for non-publishers; draft chip communicates state
-[ ] `TLS_PIN_MODE=ca` is the release default; custom anchors loaded; strict callback; hash-mode preserved behind switch; runbook merged
- [ ] `grep -r getRiderSettings flutter/lib` → 0 hits; ChoosePlanScreen consumes hub availability with graceful degrade
- [ ] Deprecation ticket for server `/api/rider/settings` filed in AUDIT_BACKLOG
- [ ] All three items' commits carry `tickets per docs/AUDIT_BACKLOG.md` trailers per repo rule

*Plan date 2026-08-26. Execute A → C → B (B last only because cert provisioning is external; code tasks have no ordering dependency).*
