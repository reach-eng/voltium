# Voltium Full Remediation Plan (2026-08-21)

**Sources:** `docs/AUDIT_ADMIN_2026-08-21.md` (86 findings, IDs `F-*`) · admin deep-audit addendum (IDs `N-*`, 16 findings) · `flutter/docs/AUDIT_DELTA_2026-08-21.md` (`N1-N5`, `F-006`) · Flutter deep-audit addendum (IDs `FL-*`, 19 findings) · project review blockers (`W*`) · **section-by-section deep audit** `docs/ADMIN_SECTIONS_AUDIT_2026-08-25.md` (~80 net-new findings, IDs `G-*` governance, `M-*` money, `R-*` rider-lifecycle, `V/S/H-*` fleet-ops, `T/I-*` support-infra) folded in below as Phases W6-W10.

**Verification snapshot (this plan's baseline):**
- `web`: lint ✅ · typecheck ❌ — **two independent breaks**: `vitest.config.ts:38` (W4 live-server config typing) and `support.use-cases.ts:120` (`orderBy:{sortOrder}` on nonexistent column — see Phase 0 W-0) · unit tests: 41 failing / 2,989 passing across 13 untracked `admin-panel-*` suites
- `flutter`: analyze ✅ clean

**ID provenance:** `[B]` = claim from baseline audit, not re-verified line-by-line · `[V]` = independently verified this pass.

---

## Phase 0 — Unblock CI (~0.5 day)

| ID | Fix | Files | Acceptance |
|---|---|---|---|
| W-0 | **One-line build fix:** `orderBy: { sortOrder }` → `order` (`web/src/server/modules/support/support.use-cases.ts:120`) — column is `order Int`; current form fails typecheck AND 500s `/api/support/faqs`. (Detailed in Phase W9 F-FAQ.) |
| W-1 | Repair `defineConfig(async () => …)` typing in the new W4 config: the returned literal carries keys (`oxc`) incompatible with `ViteUserConfigExport`. Either cast through `satisfies UserConfig` after removing unknown keys, or pin the intended vitest/vite pairing. | `web/vitest.config.ts:1-50` | `npm run typecheck` green |
| W-2 | Triage the 13 untracked `tests/unit/admin-panel-{batch-a,b,c,phase1..4}*.test.ts` suites (41 failures). For each suite: (a) if its target fix landed → repair test to match shipped behavior; (b) if fix never landed → move test into the matching PR below; (c) if aspirational → delete. No suite may stay red on main. | 13 files under `web/tests/unit/` | `npm run test:unit` green |
| W-3 | Refresh AGENTS.md counts (currently claims 2,958/298 files). | `AGENTS.md` | Counts match actual run |

---

## Phase W1 — Web P0 correctness & auth gates (3 days) → PR-A

Ships baseline P0s plus both new P0/P1-class security fixes. Order within phase = risk order.

| ID | Finding | Fix | Verified at |
|---|---|---|---|
| N-1 `[V]` | Universal `'111111'` master OTP enabled by bare `ENABLE_TEST_OTP=true` regardless of env; comment contradicts code | In `otp-store.ts:119-124` require `APP_ENV==='development' && NODE_ENV==='development'`; drop the flag-only OR-clause. Add unit test: staging/prod + flag set ⇒ random OTP. | `otp-store.ts:119-124` |
| N-2 `[V]` | DB rate-limit buckets never reset `points` on window rollover → permanent self-extending lockout (DoS on admin login by email, OTP delivery per phone) | Rewrite upsert CASE in `rate-limit.ts:104-116`: `points = CASE WHEN "resetAt" <= NOW() THEN 1 ELSE <increment/cap> END`. Add test: exhaust cap, advance clock past window, assert allowed. | `rate-limit.ts:104-116` |
| F-039/F-040/F-045 `[B]` | OTP echo + verify rate caps gated on `NODE_ENV`; no daily-IP union cap | Canonical `IS_PROD` helper in `lib/env.ts` (closes F-071, F-081); apply to `sendOtp` echo (`auth.use-cases.ts:89-93`), `verify-otp/route.ts:15-23`, `verify-phone/route.ts:17-20`; add `daily-auth:ip:<ip>` 24h cap (fail-closed) to all three routes. | `[B]` |
| F-036 `[V]` | Wallet-adjust audit log fire-and-forget outside money tx; `.catch(()=>{})` swallows critical-action throw | Move `createAuditLog` inside `db.$transaction` using `tx`; drop the catch. Test: stub auditLog throw ⇒ expect 500 and no Transaction row. | `wallet-adjust/route.ts:162-175` |
| F-004+F-003 `[V]` | Restore not single-flight; orphan RUNNING rows; restore-vs-backup race window | Atomic `findOrCreateRestoreJob` via `INSERT … WHERE NOT EXISTS(RUNNING)` in one statement that also flips `BACKUP_LOCK_STATUS=RESTORE_RUNNING`; move `restore.started` audit above try/catch. | `restore.service.ts:93-100` |
| F-001 `[V]` | Maintenance toggle single-click kill switch | `<MaintenanceToggleButton/>` primitive w/ typed phrase `MAINTENANCE`; wire into `MaintenanceModeScreen.tsx:121-128` + DR tab sites. | `MaintenanceModeScreen.tsx:124` |
| F-002 `[V]` | Restore wizard final click destructive | `<DestructiveConfirm expectedPhrase={backupId.slice(0,8)}>` at `RestoreTab.tsx:606-622`. | `RestoreTab.tsx:609` |
| F-005 `[V]` | Delete Backup Cancel/Delete only | Same primitive in `BackupsTab.tsx` delete dialog. | `BackupsTab.tsx:237,341` |
| F-006 `[B]` | Verify-All fan-out no rate limit/confirm/audit | Typed phrase `VERIFY ALL` + server cap 3/min/admin + `backup.verify_all` audit row (`DisasterRecoveryTab.tsx:383-427`). | `[B]` |

**Gate:** typecheck + lint + full unit + integration green; new tests for every row above.

---

## Phase W2 — Web security P1 hardening (4 days) → PR-B

| ID | Finding | Fix |
|---|---|---|
| N-3 `[V]` | Backup root admin-settable with zero containment → arbitrary mkdir/write/rmSync | Central `assertBackupRoot(p)`: `path.resolve` then prefix-check against allowlist roots (env default + explicit settings entries). Apply at: schema layer (`backup.schemas.ts:44` add refine), `getBackupRoot()` consumers, `data-management.use-cases.ts:269-271` mkdir, `deleteBackup` rmSync path, orphan cleanup job. Reject relative paths and drive-root paths. Tests: traversal (`..\..\Windows`), symlinked root, UNC path. |
| N-4 `[V]` | `process.env.BACKUP_ROOT` mutation race during scheduled backup | Thread `rootOverride` param through `createBackup()`/`applyRetentionPolicy()`; delete env mutation block (`backup.service.ts:261-284`). Test: two overlapping scheduled backups with distinct roots produce disjoint outputs. |
| N-5 `[V]` | Dual RBAC semantics; explicit grants honored at ~19/~120 sites | Standardize on `hasPermission(session, perm)` object-form; codemod ~102 string call-sites (`rbac.ts:30`, `admin.policy.ts:66`, route handlers). Ratchet lint rule banning the string form. |
| N-6 `[V]` | Permission-key typos compile silently (`admin:write`, `DATA_MANAGEMENT`) | Type `ROLE_PERMISSIONS` keys as `keyof typeof PERMISSION_DESCRIPTORS[number]['key']`; fix the two literals (`data-deletion/route.ts:17`, `dr-drill/route.ts:39`) to real descriptors or add descriptors intentionally. tsc must fail on future typos. |
| N-7 `[V]` | Unvalidated bodies incl. money math | Zod schemas for `deposits` (positive-int paise for refund/bonus), `referrals`, `riders/bulk` (`ids: array max 100`, enum action), `riders/[id]/plan`, `earnings` (closes F-052's validation half). Replace raw destructuring; stop leaking `error.message` (`riders/[id]/plan/route.ts:25`). |
| N-8 `[V]` | Impersonation header trust fail-open when APP_ENV unset | Delete `x-rider-id/x-admin-id/x-rider-phone` branches from `get-session.ts:121,135,154` (dead code) or gate identically to `rider-auth.ts:22-25` (+audit). Keep `verify-lock`'s defensive ban. |
| N-9 `[V]` | CORS reflects localhost/LAN origins with credentials in prod | Gate reflection behind `!isProd` in `middleware.ts:187-201`. |
| N-10 `[V]` | Maintenance mode bypassable by forging cookie presence | `middleware.ts:101`: replace `cookies.has()` with `verifySessionToken()` role check. |
| N-11 `[V]` | Admin login email-enumeration timing oracle | Dummy-argon2 verify on miss path (`admin.use-cases.ts:124-127`). |
| N-12 `[V]` | Rider refresh rotation lacks CAS + reuse detection | Port admin pattern: `updateMany` CAS on tokenVersion; log security event on stale version presentation (`auth/refresh/route.ts:56-71`). |
| F-041-F-044, F-063, F-085 `[B]` | Missing rate limits/idempotency/upload cap | Per baseline §4-C: caps on `auth/refresh`, `files/confirm-upload`, `files/request-read`, notifications single-rider branch; `withIdempotency` around verify-otp; pending-upload count check in `requestUploadUrl`. |
| F-076 `[B]` | `cf-connecting-ip` trusted without gate | APP_ENV-gate in `rate-limit-middleware.ts:73-99`. |
| F-058, F-086, F-055 `[B]` | RBAC route gaps | Baseline §4-B: `hasPermission` on 18 requireAdmin-only routes; permission `admins/lookup`; remove dangling `transactions_manage` reference. |
| F-059 `[B]` | `x-approval-token` header CSRF amplifier | Require JSON body only (`data-deletion/route.ts`). |

---

## Phase W3 — Audit-log integrity + PII surfaces (2.5 days) → PR-C

Baseline PR-2 + PR-7 scope:

1. `logAdminMutation({session, action, entity, entityId, details})` helper in `lib/audit-log.ts`.
2. Wire into the ~14 gap routes: notifications, announcements, incidents (POST/PUT), riders create/update, riders/bulk per-item, team-leaders/bulk per-item, referrals, rewards, earnings, offers/coupons/shifts/faqs/hubs, hubs+vehicles bulk, rider/profile PUT, transaction topup/request, transactions/bulk per-failure. `[B: F-037,F-038,F-046-F-054,F-064,F-065,F-073]`
3. PII: mask phone/emergencyContact/guarantorPhone in `KycDetailDialog` (F-007); audit `Reveal PII` (F-008); audit-log Details cell → modal (F-026); trim `verifyOtp` response to `{riderId,isNewRider,token,refreshToken}` (F-069); SOS audit retention 30d + suppress-fail semantics (F-066/67); `flattenRider` deny-list (F-095).
4. Ratchet: lint rule — any POST/PUT/DELETE handler under `/api/admin/**` without `logAdminMutation` or documented exemption fails CI.

## Phase W4 — Data-mgmt UX safety (1.5 days) → PR-D

Baseline PR-6 scope `[B: F-010,F-011,F-013,F-014,F-015,F-016,F-017,F-019,F-020,F-021,F-024,F-025,F-029]`:
extract `extractErrorMessage()` (kill 15+ raw-toast sites), `useCanRestore` extension to Backups/Schedule tabs, `EmptyState` + loading-idiom consolidation, data-management types/helpers dedup (~600 lines), sidebar session reuse, optimistic-bulk hook, `aria-current="step"`.

## Phase W5 — Code health backlog (4 days, parallelizable) → PR-E

Baseline PR-8/PR-9/PR-10/PR-11 scope `[B]`: service moves (`wallet/deposit-service` → server/modules), >25KB use-case splits, `api-handler` fold into `api-middleware`, dead-code removal (proxy.ts, withJobGuards, dashboard.ts, SosAlertBanner), PII-mask rule unification, secret-collision boot check, KYC empty-string encryption guard, MIME deny-list, maintenance-state fail-closed, OpenAPI generation, UI consolidation (EmptyState/aria/hydration/magic numbers), coverage fill for 16 untested admin screens.

## Phase W6 — Governance & money-integrity CRITICALs (2.5 days) → PR-K

Highest severity-per-item in the program. All IDs from `ADMIN_SECTIONS_AUDIT_2026-08-25.md`.

| ID | Finding | Fix | Test |
|---|---|---|---|
| G-1 | Lower-ranked admin resets SUPER_ADMIN password with own credentials (no actor/target rank check) | Rank check on every target-touching mutation (password / permissions / isActive) in `admins/route.ts:176-196` + `admin.use-cases.ts:76-126`; keep last-active-SUPER_ADMIN guard | TEAM_LEADER holding explicit-granted `admins_manage` ⇒ 403 on target above own rank |
| G-2 | Permission self-grant bypasses `canGrantRole` (explicit perms additive to role base) | Enforce subset-of-granter on PUT permissions; mirror rank rule | Self-grant of unheld permission ⇒ 403; audit row written |
| G-3 | POST `/api/admin/admins` returns Argon2 hash | Strip `password` in `createAdmin` return (`admin.repository.ts:68-82`) like PUT does | Response schema asserts no `password` key |
| M-1 | Transaction double-reversal via same-state loophole (`current===target` passes validation + CAS) | Reject `current === target` in `validateTransactionTransition` (`transaction-state-machine.ts:46`); CAS predicate requires expected≠target | Repeat REVERSE ⇒ second call 409, ledger unchanged, balance intact |
| M-2 | Re-approve inflates security deposit (`creditSecurityDeposit` has no idempotencyKey) | Add idempotency keys to deposit credit/debit ledger entries (`approve-deposit:${txnId}`); block same-state approve | Double APPROVE ⇒ single deposit increment; REFUNDED record not resurrected |
| M-3 | Rewards redemption ×100 inflation + double-redeem race | `amountInPaise = reward.points` (drop ×100) at `rider/rewards/[id]/redeem/route.ts:36`; migrate existing rows; gate with `updateMany({where:{id, redeemedAt:null}})` count check before crediting; cap award points (`validators.ts:700-704`) | ₹200 award redeems ₹200; concurrent redemptions yield one credit |
| M-4 | Referrals: no self-referral/eligibility/cap guards; orphaned credit from nested independent tx; dead dedup check | Assert `refereeId !== referrer.id && referee.referredBy === referrer.referralCode`; per-referrer cap config; pass `tx` into `walletLedgerService.credit` (`referral.use-cases.ts:105-144`); dedup on ledger idempotencyKey | Self-pair rejected; reward.create failure rolls back credit |
| M-5 | Gateway secrets returned plaintext by GET/PATCH; SSRF check advisory-only | Mask `keySecret`/`webhookSecret` (last-4) in responses; write-only secret fields; run endpoint validation in create/update superRefine; single-active toggle in one tx | GET response contains masked values only; private-range endpoint rejected at create |
| M-6 | Reconciliation drift formula excludes REFUND which mutates balance ⇒ phantom drift for every refunded rider | Include REFUND in ledger sum (`wallet-reconciliation.job.ts:101`, drop stale exclusion); admin-run recon persists report row | Post-refund wallet reconciles to drift 0 |

## Phase W7 — Rider lifecycle, KYC & deposit integrity (3 days) → PR-L

| ID | Finding | Fix |
|---|---|---|
| R-1 | Admin rider PUT writes arbitrary `lifecycleStatus` bypassing state machine | Route through `transitionRiderStatus(id, target)` inside tx (`riders/route.ts:59`, `admin-riders.use-cases.ts:445-447`); unknown targets ⇒ 400 |
| R-2 | Admin PATCH stores KYC PII unencrypted (aadhaar/pan/account/ifsc) | Run admin-supplied KYC fields through `encryptKycData()` (`admin-riders.use-cases.ts:57-74,417-419`); backfill migration for plaintext rows |
| R-3 | KYC/guarantor decision TOCTOU — concurrent APPROVE+REJECT both succeed | Conditional status-guarded updates (`updateMany` + count check) as first statement in approveKyc/rejectKyc/requestInfo and guarantor equivalents (`kyc.repository.ts:147-243`) |
| R-4 | Post-approval document swap via identical-status resubmit | `submitKyc` allowed only from DRAFT/INFO_REQUIRED/REJECTED; APPROVED/EXPIRED resubmission ⇒ explicit error (`kyc-state-machine.ts:39-41`) |
| R-5 | Pickup allowlist hands vehicles to pre-KYC riders | Restrict `ALLOWED_PICKUP_STATUSES` to PICKUP_SCHEDULED (+ audited explicit-override flag) (`completeVerification.ts:84-100`) |
| R-6 | Deposits: refund uncapped (negative deposit), partial refunds stranded, double-refund race | Clamp refund to remaining; PARTIALLY_REFUNDED intermediate state; guarded status-first update; idempotency keys on deposit ledger entries (`deposit-service.ts:235-368`) |
| R-7 (bundle) | Mediums: bulk accountStatus silent no-op; END_RENTAL orphans lease/vehicle; balance-set idempotency swallows repeats; APPROVE emits no outbox event; two contradictory lifecycle orderings; guarantor reason/audit missing; incidents no severity escalation + resolver clobber; score recalc races + `'PENDING'` bug; raw KycProfile in detail GET | Map bulk action→validated lifecycleStatus w/ per-item results; close lease+flip vehicle in same tx; nonce-based balance idempotency; move KYC_APPROVED emit into shared path; reconcile lifecycle ranks vs state machine into one DAG source; persist guarantor rejectionReason + audit + notify parity; incident severity transitions + preserve original resolver; advisory-lock/P2002-retry recalc + `'DRAFT'` fix; reuse `findByRiderIdForAdmin` + masks |

## Phase W8 — Fleet & ops state-machine / permission splits (2.5 days) → PR-M

| ID | Finding | Fix |
|---|---|---|
| V-1 | Single-vehicle PUT bypasses vehicle state machine (only bulk validates) | `validateVehicleTransition(current, target)` inside `updateVehicle` after re-read; `VehicleStateError`→409 (`vehicles/route.ts:126`) |
| S-1 | `ops_read` grants shift CREATE/UPDATE/DELETE fleet-wide | Mutations require `shifts_manage`; broad OR-list stays GET-only (`shifts/route.ts:34-94`) |
| S-2 | Shift delete misses 4 lease statuses AND hard-deletes against Restrict FK ⇒ guaranteed 500 | Full non-closed-status guard; soft-delete/archive strategy instead of hard delete |
| V-2..V-6 (bundle) | Vehicle mediums: duplicate-number TOCTOU→500; reassignHub skips hub-existence/lease/cache; markForMaintenance guards only ACTIVE; UI filters client-side over one page; undo replays unvalidated PUT, can't restore deletes | P2002→409 mapping + sequence-based IDs; transactional reassign w/ guards + `invalidateVehicleCache`; share `NON_CLOSED_LEASE_STATUSES`; pass search/status to server query; dedicated guarded undo endpoint incl. `deletedAt:null` restore |
| H-1..H-3 (bundle) | Hub DELETE counts soft-deleted vehicles; duplicate hub names allowed; PUT diff-audit compares raw Zod input | `deletedAt:null` filter; unique (name, city) + P2002→409; adopt `withApiHandler`, diff parsed scalars |

## Phase W9 — Support, comms & content integrity (2 days) → PR-N

| ID | Finding | Fix |
|---|---|---|
| T-1 | Ticket bulk actions bypass state machine; `revert` forces forbidden CLOSED→OPEN | Filter ids through `validateTicketTransition` per-id inside tx (`support.use-cases.ts:270-324`) |
| T-2 | Assignment last-write-wins; assignee never validated | CAS `where:{id, assignedTo:null}` (or version column); validate assignee is active admin |
| T-3 | `escalate` in schema but unimplemented ⇒ 500; priority silently dropped; reply gated by view-only perm; TicketStateError → 500 | Implement-or-remove escalate + unknown-action 400; destructure/pass priority; reply requires `tickets_reply`/`tickets_manage`; map state errors→409 |
| F-FAQ | **Build-breaking** `orderBy:{sortOrder}` on nonexistent column (typecheck red + rider FAQ 500) | One-line fix to `order` (`support.use-cases.ts:120`) — also tracked as Phase 0 W-0; serialize reorder (advisory lock) + renormalize after order-changing mutations |
| A-1 | Scheduled announcement fan-out duplicates (SCHEDULED until job flips; Notification uniqueness absent so skipDuplicates no-ops) | Atomic claim `updateMany SCHEDULED→PROCESSING` pre-emit; add Notification uniqueness per announcement (`announcement-broadcast.job.ts:84-130`) |
| A-2 | ALL-audience confirm+rate-limit skipped when scheduled; `channel:'SMS'` silently sends nothing; scheduledAt unvalidated garbage→500 | Apply gates whenever audience=ALL; implement SMS branch or restrict enum; `z.string().datetime()` + past-date rejection |
| L-1 | Legal saves go live instantly; revision history unreachable | DRAFT/PUBLISHED lifecycle + publish action; revision list/restore endpoints (`legal.use-cases.ts:20-57`) |

## Phase W10 — Observability & infrastructure resilience (3 days) → PR-O

| ID | Finding | Fix |
|---|---|---|
| I-1 | **Manual/"run-now" backup is a silent no-op** — emitted `ADMIN_JOB_SCHEDULED_BACKUP` has zero registered consumers | Register WORKERS entry routing the event type to the backup runner (`workers/index.ts:79-269`); add PENDING-age alarm for unconsumed event types |
| I-2 | Crashed backup wedges pipeline forever: TTL-less lock + stale RUNNING rows never age out | Honor `BACKUP_LOCK_STARTED_AT` auto-release threshold in `acquireLock`; staleness reaper for BackupJob RUNNING/QUEUED older than N×expected duration (`backup.service.ts:679-761`) |
| I-3 | Outbox reaper double-executes long jobs (5-min cutoff < broadcast durations); resume marker lost on reclaim ⇒ duplicate mass notifications | Heartbeat `updatedAt` during processing or per-type reaper timeouts sized to max duration; preserve resume marker across reclaim (or claim-one-at-a-time) (`job-queue.ts:103-203`) |
| I-4 | Failed scheduled backup retries ~288×/day (failure doesn't advance nextRunAt) | Backoff nextRunAt on failure (+30min doubling, cap 24h) (`backup.repository.ts:33-38`) |
| I-5 | Analytics monthly trend groupsBy exact timestamp (cost scales with rowcount); three inconsistent timezone bucketings; fragile revenue-trend join untested | `date_trunc('month')` bucketing; unify IST-aware bucket helper; behavioral test pinning raw-row→key contract (`analytics.use-cases.ts:146-198`) |
| I-6 | Telemetry ingestion untyped/unquota'd — unbounded PII table growth per rider | Zod-validate shapes per type; upsert/dedupe natural keys; per-rider hourly row quota (`device-compliance.use-cases.ts:132-182`) |
| I-7 | Storage tab walks directories synchronously inside requests (event-loop stall) | Async walk with file-count/depth budget + 60s cache (`backup.service.ts:779-831`) |
| I-8 | DR drill passes on months-old backups; echoes internal error strings | Freshness floor (latest COMPLETED ≤48h) for step 4; generic 500 body; 409 during active restore lock |
| I-9 (bundle) | Memory-only scheduler fire-once guards (dup after restart); hourly cleanup runs 60×; checksum loads multi-GB files into RAM; backups POST accepts unvalidated `type` (PRE_RESTORE lock-bypass reachable); maintenance-mode PUT unvalidated; metrics route lacks tiering + non-constant-time compare | Idempotency-key pattern for recon/daily-engagement emitters; minute-gate 03:00 task; stream hashing; `z.enum` on type + reject PRE_RESTORE from public API; Zod on maintenance PUT; `monitoring_view` permission + timingSafeEqual |

---

## Phase W11 — Admin UI data-population fixes (6.5 days) → PR-P

Source: admin-panel population audit (2026-08-25; ~30 screens traced fetch → envelope → fields → render). Four defect classes: shipped mocks, envelope-location mismatches, page-local aggregation posing as global, unit/field-name drift. Money units verified correct on riders/deposits/transactions/plans — no rupee/paise confusion found outside U-16.

### W11a — Mocks, dead endpoints & envelope contracts (2 d)

| ID | Defect (what renders wrong) | Fix |
|---|---|---|
| U-1 | **AuditLogScreen shows 3 hardcoded fake rows**; search filters the mock; real trail never renders despite working API | Replace with existing `GET /api/admin/audit-logs`; wire search+filters+pager (`AuditLogScreen.tsx:26-60`) |
| U-2 | BackupsTab permanently empty + error toast; RestoreTab offers zero backups | Route returns `{items,total}`, tabs expect `{jobs,pagination}`; `BigInt sizeBytes` breaks JSON ⇒ intermittent 500. Map payload + `Number(sizeBytes)` (`backups/route.ts:36`; `BackupsTab.tsx:256-259`; `RestoreTab.tsx:255`) |
| U-3 | BackupLogsTab always empty; search/date/action filters no-op; pager pinned to 1 | Exact-match `entity='BackupJob,…'` matches nothing ⇒ `entityIn` support or dual requests; wire `q/from/to/actionPrefix`; read top-level `json.pagination` (`BackupLogsTab.tsx:259-270`; `audit-logs/route.ts:40-47`) |
| U-4 | Announcements confirm dialog "Broadcast to ALL **0** riders"; BY_HUB/BY_STATE counts 0 | Read `json.data.pagination.total`; add `hubId` filter to riders list or count endpoint (`useBulkMessaging.ts:85,93,97` vs `riders/route.ts:120-139,174`) |
| U-5 | Vehicle table crash risk when `data.vehicles` absent | `Array.isArray` guard (`useVehicleManagement.ts:75`) |

### W11b — Truthful aggregation & server-side filtering (2 d)

| ID | Defect | Fix |
|---|---|---|
| U-6 | **Dashboard trend chart flat ₹0 × 7 days**, silent | Prisma maps `DATE()` to JS Date; string keys miss ⇒ `DATE("createdAt")::text AS date` or normalize keys (`dashboard.ts:83,101-107`); behavioral test pinning raw-row→key contract |
| U-7 | "Total Revenue" KPI permanently ₹0 | Return lifetime approved RENT_PAYMENT sum from `getDashboardStats()` or drop card (`dashboard/types.ts:94-99`; `dashboard.ts:46-61`) |
| U-8 | JobsScreen: 7 of 8 cards forever "**Never Run**" while cron runs daily | Workers upsert `job:last_run:<id>={timestamp,status,details,error}` — no writer exists today (`jobs/route.ts:133-147` reader-only) |
| U-9 | Incidents: count cards page-local (>20 rows wrong); Photos/Timeline/Resolved tabs permanently empty | Return server `statusCounts` (route discards them); fetch `/api/admin/incidents/[id]` on dialog open and merge (`incidents/route.ts:27`; `useIncidents.ts:236-241`) |
| U-10 | Ticket tab badges ≤20 / other tabs show 0 regardless of totals | Server-side per-status counts (`useTickets.ts:164-171`) |
| U-11 | Scores: risk cards/leaderboard change with pagination; Vehicle/Location bars render fabricated zeros as if measured | Server aggregate counts; omit stub sub-scores until computed (`useRiderScoring.ts:99-108`; `ScoreBreakdownDialog.tsx:26-103`) |
| U-12 | Scores hub filter silently does nothing | Implement hub predicate via `rider.pickupHub` or remove dropdown (`scores/route.ts:17-29`) |
| U-13 | KYC review queue hard-capped at first 100 rows, no pager | Wire page/totalPages like riders list (`useKyc.ts:31`) |
| U-14 | Hubs #21+ invisible/unsearchable; CSV export + bulk ops act on truncated set | Adequate limit or real pagination (`useHubs.ts:44`) |
| U-15 | Vehicle search: plate on page 2 ⇒ "No vehicles match", unreachable | Send `search/status/hubId` server params (supported at `vehicles/route.ts:32-33`; add server `search`), reset page on filter change (`useVehicleManagement.ts:71,247-257`) |

### W11c — Field-name & unit drift (1.5 d)

| ID | Defect | Fix |
|---|---|---|
| U-16 | Coupons: entered minAmount ₹100 displays **₹1** (stored unit wrong too) | `×100` on write aligning with `discountValue` + migration (`coupon.use-cases.ts:64` vs `:36`) |
| U-17 | Incidents: Insurance always "No"; assignee always "Unassigned" | Payload emits `insuranceClaim`/raw id, client reads `hasInsurance`/`assignedToName` — rename client or extend mapper; resolve admin name server-side (`IncidentDetailDialog.tsx:171`; `IncidentTable.tsx:105`) |
| U-18 | Rider permission matrix always "Required" even when granted | Include grant booleans in list select (`admin-riders.use-cases.ts:179-282`; defaults at `flatten-rider.ts:181-189`) |
| U-19 | Advance-rent badge can never show PAID | Select `advanceRentPaid` (`flatten-rider.ts:150` coerces missing ⇒ false) |
| U-20 | Work tab: five fields permanently blank; Assigned TL shows raw cuid | Align names with flatten output (`lib/types/admin.ts:25,43-44`); include `teamLeaderRef` join (`RiderTLAssignmentTab.tsx:34-122`) |
| U-21 | DOB `type="date"` inputs can neither display nor save DD-MM-YYYY values (400 swallowed) | Client conversion or masked text input (`RiderProfileTab.tsx:136`; `RiderGuarantorTab.tsx:65`; regex `riders/route.ts:36-39`) |
| U-22 | Money-tab ghost edits (incl. invalid `PAID`) silently stripped while other fields save | Make read-only; deposits flow via Deposits API (`RiderMoneyTab.tsx:74-139`) |
| U-23 | Guarantor select offers `VERIFIED`, rejected by schema ⇒ silent failure; `/api/admin/guarantors` has zero consumers | Restrict enum; build-or-delete orphaned endpoint decision (`RiderGuarantorTab.tsx:109`) |
| U-24 | Analytics "Collection Efficiency" displays fleet utilization; delta caption "vs last month" computed against fixed target 80 | Compute collected/due or rename; explicit delta basis (`analytics.use-cases.ts:102`; `AnalyticsKpiCards.tsx:42-75`) |

### W11d — Staleness & self-check honesty (1 d)

| ID | Defect | Fix |
|---|---|---|
| U-25 | FAQs & Shifts don't reflect mutations for up to 60s | `cache:'no-store'` on post-mutation refetches or drop max-age (`admin/faqs/route.ts:23`; `shifts/route.ts:51`) |
| U-26 | DR checklist: impossible item + false positive; drill green on months-old backups | Add `secondaryBackupRoot` to overview payload; verify-item from real flag; recency gate feeding checklist + health card (`DisasterRecoveryTab.tsx:248-343`; `data-management.use-cases.ts:43-49`) |
| U-27 | Verify-All reports "50 verified, 50 failed" after 50/50 successes | Delete stray unconditional `failed++` (`DisasterRecoveryTab.tsx:413-417`) |
| U-28 | SystemHealth "Database" probe times an authenticated tickets call (auth blip ⇒ false outage); "API" latency measures cached route | Unauthenticated DB probe; relabel API row ("cached admin API") (`runHealthChecks.ts:16-50`; `SystemHealthDialog.tsx:22-48`) |
| U-29 | Overview Database tile "0 B"; backup sizes disagree between tabs | Reuse pg size override in `getOverview`; single-source sizes (`backup.service.ts:807,817-831`) |
| U-30 | Team-leader stats dialog serves pre-mutation snapshot | Invalidate `statsCacheRef` on all TL mutations (`useTeamLeaders.ts:242,297-332`) |

---



## Phase F1 — Flutter P0 correctness (1 day) → PR-F

| ID | Finding | Fix |
|---|---|---|
| FL-1 `[V]` | Envelope unwrap mismatch silently kills notifications/rewards/referrals in prod — **blast radius confirmed wider 2026-08-25**: same gate pattern also at `pickup_hub_screen.dart:278`, `earnings_screen.dart:268` (defensive triple-check, OK), `locked_overlay.dart:112-114` (works only because server nests literal `success`; fragile). Plans/hubs lists work only because array payloads keep the envelope (`api_client.dart:780-788`). | Decide one contract: `_handleResponse` returns envelope untouched (map/list passthrough) and providers read `success/data`; OR keep unwrap and fix all gates. Prefer contract A (envelope-preserving) + thin `ApiEnvelope<T>` accessor; migrate all consumers; add unit tests using REAL server envelope shapes captured from route handlers (`rider/notifications`, `rewards`, `referrals`, `plans`, `hubs`, `device/verify-lock`). |
| FL-22 `[V]` | **Profile parse crash on odd-paise balances**: server emits unrounded `walletBalance: paise/100` (`web/src/server/modules/riders/rider.use-cases.ts:822`) — ₹1999.50 serializes `1999.5`; generated model casts `json['walletBalance'] as int?` (`flutter/lib/core/network/generated/api_models.dart:220`) ⇒ TypeError ⇒ profile fails to populate for every rider whose balance isn't whole rupees. Dashboard immune (`_toDouble`). | Both sides: server `Math.round()` at `rider.use-cases.ts:822` + audit all `*Rupees` producers for rounding; client harden to `(json['walletBalance'] as num?)?.toDouble()` and sweep `api_models.dart` for other `as int?` casts on rupee fields. Test: fixture balance `199950` paise parses to `1999.5` without throwing. |
| FL-23 `[V]` | **FaqScreen unpopulated for ALL riders while server bug W-0 is open**: `/api/support/faqs` 500s (`orderBy:{sortOrder}` nonexistent column), so the app's FAQ tab shows error/empty regardless of client correctness — cross-repo population failure. | Hard dependency on Phase 0 **W-0**. Acceptance: after W-0 lands, FaqScreen renders categories/Q&A from live API; add contract test pinning `/api/support/faqs` response shape; add error+retry surface on FaqScreen (page-audit flagged missing failure states). |

## Phase F2 — Logout/session isolation (1 day) → PR-G

| ID | Fix |
|---|---|
| FL-2 `[V]` | Call `notificationProvider.notifier.clearAll()` in `RiderLogoutOrchestrator.run()`; assert store empty post-logout in widget test. |
| FL-3 `[V]` | Clear offline queue on logout: `OfflineStorageService.clearAll()` in orchestrator + defense-in-depth stamp ops with riderId and drop foreign rows at flush. Integration test: queue op as rider A → logout → login B → go online ⇒ zero replays. |
| FL-13 `[V]` | Scope `document_local_cache` keys/paths by riderId; encrypt at rest (secure-storage-backed or AES) ; TTL sweep on init. |
| Delta F-006 `[V]` | `isNewRider ?? false` → make backend always send field; client defaults null→`true` (fail toward onboarding) at `repository_impl.dart:57`; contract test pins backend field presence. |

## Phase F3 — Network/offline integrity (2 days) → PR-H

| ID | Fix |
|---|---|
| FL-4 `[V]` | Idempotency keys minted per logical operation BEFORE first send; attached to retries AND offline replay. Server already dedupes on `idempotencyKey` for top-up/tickets — wire client to it. |
| FL-7 `[V]` | `_flushInFlight` single-flight flag in `connectivity_provider.dart` flush loop. |
| FL-5 `[V]` | memCache hits honor `expires_at`; `_memCache.clear()` inside `clearAll()` (`offline_storage_service.dart:117-118,235-241`). |
| FL-9 `[V]` | `close()` nulls `_db`; memoize `init()` future (`:23-34,243-246`). |
| FL-6 `[V]` | Hydration-before-mutation: notification provider exposes loading until `_hydrate` completes; merge hydrated+live lists. |
| FL-8 `[V]` | Ticket provider: consume `supportRepositoryProvider`; set `lastError`; error/retry UI. |
| FL-14 `[V]` | `unawaited(...catchError(log))` on mark-read PUT; rollback or refetch on failed clear-read batch (`engagement_provider.dart:203-205,268-284`). |

## Phase F4 — Platform hardening (1 day) → PR-I

| ID | Fix |
|---|---|
| FL-10 `[V]` | Remove global `usesCleartextTraffic`; add `network_security_config.xml` allowing cleartext only for debug/dev hosts (10.0.2.2, localhost) via `@xml/network_security_config` referenced from manifest. |
| FL-11 `[V]` | `android:allowBackup="false"` + `dataExtractionRules` excluding sqflite DBs, shared_prefs caches, documents dir (Aadhaar/PAN cache, offline queue, notifications store). iOS equivalent: exclude from iCloud backup (`NSFileManager URLIsExcludedFromBackupKey` in doc cache writer). |
| FL-12 `[V]` | Pinning upgrade (optional, flagged): pin SPKI sets via `SecurityContext.setTrustedCertificatesBytes` so valid-chain MITM also fails; keep failure-path hash check as second layer. Document rotation runbook incl. dynamic-pin bootstrap. |

## Phase F5 — Flutter medium/low sweep (2.5 days) → PR-J

FL-15 MethodChannel catchError uniformity · FL-16 delete `ReceiptPreview` (or fix rupees + substring guard) · FL-17 fee math in paise ints, % from config/API · FL-18 l10n sweep of ~34 files (~121 strings; worst: guarantor_onboarding 7, pickup_hub 6, device_policy_provider 5) · drop dead deps `provider` + `go_router` from pubspec · delta leftovers N4 (delete `VoltiumApiService`, call `VoltiumApiClient` directly) and N5 (move `AppShell` out of main.dart) · **FL-20** delete `GradientWalletCard`/`MiniWalletCard` (`features/wallet/widgets/wallet_card.dart:124,216` divide rupee balances by 100 — 100× underscale landmines, zero call sites) · **FL-21** replace verify-lock's accidental inner-`success` reliance with an explicit response contract + test.

---

## Cross-cutting (end of program)

- Repo hygiene commit: purge tracked screenshots/scratch docs; gitignore zips/logs; resolve `nul`; single hook system (husky XOR lefthook).
- `graphify update .` after each merged phase.
- Update AGENTS.md counts + Flutter E2E inventory once suites stabilize.

## Dependency DAG

```
Phase 0 ──► everything (CI green prerequisite)

Web baseline chain:   W1 ──► W2 ──► W3 ──► W4 ──► W5
Web hardening chain:  W6 ──► W7 ──► W8 ──► W9 ──► W10 ──► W11   (starts right after Phase 0; independent of baseline chain)
Flutter chain:        F1 ──► F2 ──► F3 ──► F4 ──► F5

W6 (governance/money criticals) may run in parallel with W1 — different files, highest severity.
W9's FAQ fix is pre-empted by Phase 0 W-0; Flutter FL-23 (FaqScreen population) is blocked on the same W-0 one-liner.
Cross-chain conflicts: W2 and W6 both touch permissions/RBAC surfaces — land W2 before W7's R-1;
W3 and W6 both touch audit-log helper — reuse `logAdminMutation` from W3 in W6+.
```

## Effort summary

| Track | Days |
|---|---|
| Phase 0 | 0.5 |
| Web baseline W1-W5 | 15 |
| **Web hardening W6-W10** | **13** |
| **Web UI population W11** | **6.5** |
| Flutter F1-F5 | 8.5 |
| Cross-cutting | 1 |
| **Total** | **~44.5 dev-days** |

Two engineers running the web chains in parallel: ~24 calendar days. One engineer sequential: ~44.5 days.

## Verification matrix (every phase exit)

- Web: `npm run typecheck && npm run lint && npm run test:unit` (+ integration/API when dev server up) — coverage ≥85% gate holds.
- Flutter: `flutter analyze && flutter test` (+ phased E2E runner for touched flows).
- Each PR: tests added for every fixed finding; no skipped tests merged.

### Data-population gate (program exit criterion — "app fully correctly populated")

After F1 + FL-22 + W-0 ship, every surface in the 2026-08-25 contract matrix (`ADMIN_SECTIONS_AUDIT_2026-08-25.md` §7) must be ✅, enforced by contract tests using real server envelope shapes:

| Surface | Required post-fix state |
|---|---|
| Wallet balance / history | ✅ already correct — regression-pin rupee units |
| Plans list, Hub list | ✅ array-envelope passthrough — pin shapes |
| Tickets list, KYC status, Earnings GET/POST | ✅ map-unwrap consumers — pin `{tickets}`/`{kycStatus}`/`{earnings}` shapes |
| **Rewards points/streak/list** | ✅ populates (FL-1 fix) |
| **Referrals data** | ✅ populates (FL-1 fix) |
| **Notifications + unread badge** | ✅ populate (FL-1 fix) |
| **Profile (typed model)** | ✅ parses at any paise value (FL-22 fixtures) |
| **FAQ screen** | ✅ renders live categories/Q&A (FL-23 ⇐ W-0) |
| Device verify-lock | ✅ explicit shape contract, no accidental inner-`success` reliance (FL-21) |
| Pricing / Settings endpoints | ⚪ dormant by design — either wire a consumer or delete the generated methods (decision in F5) |

A CI-runnable contract-test suite (Flutter unit tests hitting recorded envelope JSONs per endpoint) is the deliverable that proves this gate; it lives with PR-F.

### Admin data-population gate (program exit criterion — "admin panel fully correctly populated")

After W11 ships, every screen in the 2026-08-25 population trace must show real API data, enforced by component/integration tests:

| Criterion | Proof |
|---|---|
| **Zero mocked data paths in admin components** | CI grep ratchet: no `setTimeout`-fed fixture arrays rendered as fetch results (`AuditLogScreen` pattern) |
| Dashboard trend + Total Revenue | Chart buckets non-zero on seeded data; KPI backed by a real aggregate; behavioral test on the date-key join (U-6/U-7) |
| Backup surfaces alive | BackupsTab/RestoreTab/BackupLogsTab list rows from the live endpoint with working filters/pager (U-2/U-3); BigInt serialization covered by a route test |
| Jobs truthfulness | After one worker cycle, ≥1 `job:last_run:*` key exists per job id (U-8 integration test) |
| Counts are global, not page-local | Incidents/tickets/scores badges match DB counts with >20 fixtures (U-9/U-10/U-11) |
| Filters hit the server | Vehicle search finds a row on page 2 (U-15); scores hub filter changes results (U-12) |
| Unit round-trips | Coupon minAmount ₹100 persists and redisplays as ₹100 (U-16 test) |
| Recipient counts correct | Bulk-messaging confirm shows true totals for ALL/BY_HUB/BY_STATE (U-4) |
| No silent save failures | DOB edit round-trips (U-21); guarantor enum values all accepted (U-23); ghost money-tab controls removed (U-22) |
| Honest self-checks | DR drill fails on stale backup fixture (U-26); Verify-All counts add up (U-27); health probes labeled accurately (U-28) |
