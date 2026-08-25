# Voltium Admin Panel — Section-by-Section Deep Audit (2026-08-25)

**Method:** 5 parallel read-only auditors covering every `/api/admin/**` section group + UI where present, plus a Flutter data-population contract review (§7). Baseline exclusions applied: `docs/AUDIT_ADMIN_2026-08-21.md` (F-001..F-097), web addendum N-1..N-16 (`docs/REMEDIATION_PLAN_2026-08-21.md`). Everything below is **net-new**.

---

## 0. Scoreboard

| Domain | Sections | Verdict |
|---|---|---|
| Rider lifecycle | riders, kyc, guarantors, onboarding†, pickup, incidents, scores, deposits | **FAIL** (KYC races, PII plaintext write path, pickup gate bypass, deposit money bugs) |
| Money flows | transactions, earnings, rewards, referrals, payment-gateways, reconciliation, plans, offers/coupons | **FAIL** (3 new CRITICALs: double-reversal, deposit inflation, rewards ×100) |
| Fleet & ops | vehicles, hubs, shifts, fleet, rentals, team-leaders, workflow-coverage, operations | **FAIL** (vehicle state-machine bypass; `ops_read` can mutate shifts fleet-wide) |
| Support & comms | tickets, notifications, announcements, faqs, legal | **FAIL** (bulk bypasses ticket state machine; scheduled announcement dup fan-out; build-breaking FAQ bug) |
| Governance | admins, auth(admin), settings, system-settings, feature-flags, audit-logs | **CRITICAL** (rankless password reset ⇒ SUPER_ADMIN takeover; hash leak; masking bypassed on secondary surface) |
| Observability & infra | dashboard, analytics, monitoring*, telemetry*, data-management, dr-drill, maintenance-mode, jobs/workers | **AT RISK** (manual backup is a silent no-op; crashed backup wedges pipeline forever; outbox reaper double-executes long jobs) |

\* `/api/admin/monitoring|telemetry` don't exist — monitoring lives at `/api/monitoring/metrics`; telemetry ingestion at `/api/rider/sync/device-data` + `/api/device/data`.
† No `/api/admin/onboarding/**` exists at all.

---

## 1. Governance — highest severity first

- **CRITICAL G-1 · Lower-ranked admin resets a SUPER_ADMIN's password using only their own credentials.** Password-change branch verifies `currentPassword` against the *actor* and updates the *target*; neither route nor use-case compares actor/target rank (`admins/route.ts:176-186`, `admin.use-cases.ts:76-126`). `admins_manage` is `[]` in the matrix — exists only via explicit grant, which makes it an escalation token. Session invalidation even locks the victim out. Fix: rank check on every target-touching mutation.
- **HIGH G-2 · Permission self-grant bypasses `canGrantRole`.** PUT sanitizes permission keys against the allowlist but never enforces subset-of-granter; explicit perms are additive to role base (`permissions.ts:89-93`) ⇒ any `admins_manage` holder grants themselves anything without touching `role` (`admins/route.ts:188-196`).
- **HIGH G-3 · `POST /api/admin/admins` returns the new admin's Argon2 hash** (`admin.repository.ts:68-82`, route wraps raw create; PUT strips, POST doesn't).
- **MEDIUM G-4 · Settings masking bypassed on `/api/admin/settings`:** GET returns raw values for every SystemSetting row; `update()` hard-flips `isSecret:false, isEditable:true` on every upsert (`setting.use-cases.ts:14-33,52-75`) — permanently demoting secrets.
- **MEDIUM G-5 · Feature-flag cross-type coercion:** boolean stored for numeric flag ⇒ `parseInt('true')=NaN` ⇒ upload size NaN globally until corrected (`feature-flags.ts:88-94,148-151`). Cross-pod cache staleness ≤5 min acknowledged.
- LOW: `admins/lookup` unpermissioned email-directory disclosure (known family, distinct route).
- **PASS:** admin auth (IP+email limits, timing equalization, CAS refresh w/ grace window); audit-logs (parameterized, gated, PII-redacted).

## 2. Money flows

- **CRITICAL M-1 · Double-reversal via same-state loophole.** `validateTransactionTransition` early-returns on `current === target` (`transaction-state-machine.ts:46`); CAS matches expected==new so repeat REVERSE passes, each writing another offsetting ledger entry (`allowNegative:true`). Repeat clicks drain wallets negative.
- **CRITICAL M-2 · Re-approve inflates security deposit.** `creditSecurityDeposit` takes/writes **no idempotencyKey** (`wallet-service.ts:210-249`); APPROVE→APPROVED passes both gates and increments the deposit again, and can resurrect a REFUNDED record.
- **CRITICAL M-3 · Rewards redemption ×100.** Points stored paise-style ("₹200 award → points 20000") but redeem computes `amountInPaise = reward.points * 100` (`rider/rewards/[id]/redeem/route.ts:36`) ⇒ ₹200 redeems as ₹20,000. Plus redemption race: no CAS on `redeemedAt`, no ledger idempotency (double-credit).
- **HIGH M-4 · Referrals:** no self-referral check, no eligibility (`referee.referredBy`) verification, no cap (`referral.use-cases.ts:63-84`); nested independent tx commits wallet credit without parent Transaction/Reward rows when reward.create fails (`:105-144` — fix: pass `tx`); dedup pre-check matches wrong field and never fires.
- **HIGH M-5 · Payment-gateway secrets returned plaintext** by GET/PATCH (`payment-gateways/route.ts:48-56`) readable by `transactions_view` holders; endpoint SSRF validation advisory-only (test-connection), not enforced at write.
- **HIGH M-6 · Reconciliation drift formula excludes `REFUND`**, but refunds credit `balanceInPaise` via `creditWallet(category:'REFUND')` ⇒ permanent phantom drift for every refunded rider (`wallet-reconciliation.job.ts:101`, `deposit-service.ts:254-261` vs the stale P1-19 comment).
- MEDIUM: transaction approve is claim-first, side-effects not atomic (stuck approved-but-uncredited, retry 409s forever); deposit fallback ignores record state/amount mismatch; earnings stores rupees in `amountInPaise` column (100× trap for consumers); plan switch mid-cycle resets billing window free (no proration); coupon `minAmount` unit break (rupees in, ÷100 out); coupon usage enforcement nonexistent (`currentUses` never written/read).
- **PASS:** plans durationDays override properly server-enforced (DAILY=1/WEEKLY=7/MONTHLY=30).

## 3. Rider lifecycle

- **HIGH R-1 · Admin rider PUT writes arbitrary `lifecycleStatus`** — `updateRiderSchema` allows any string through `SAFE_RIDER_FIELDS`; `transitionRiderStatus` never invoked (`riders/route.ts:59`, `admin-riders.use-cases.ts:445-447`).
- **HIGH R-2 · Admin PATCH stores KYC PII unencrypted** (aadhaar/pan/account/ifsc via `sanitizeText` only into `kycData.upsert.update` — no `encryptKycData()`) creating mixed ciphertext/plaintext rows (`admin-riders.use-cases.ts:57-74,417-419`).
- **HIGH R-3 · KYC decision TOCTOU:** approve/reject/requestInfo read status outside tx, guarded `update` has no status predicate — concurrent APPROVE+REJECT both succeed, contradictory notifications emitted (`kyc.repository.ts:147-161,196-243`). Same pattern in guarantor review.
- **HIGH R-4 · Post-approval document swap:** state machine treats identical-status as success (`kyc-state-machine.ts:39-41`), so SUBMITTED→SUBMITTED resubmission overwrites Aadhaar/PAN/bank while APPROVED stays.
- **HIGH R-5 · Pickup allowlist defeats all gates:** `ALLOWED_PICKUP_STATUSES` includes pre-KYC states (KYC_SUBMITTED, GUARANTOR_SUBMITTED, DEPOSIT_PENDING…) — physical handover before any human review (`completeVerification.ts:84-100`, `rental.use-cases.ts:330-341`). Atomic claim itself is sound; the admin COMPLETE_PICKUP path bypasses it entirely (no lease, no vehicle flip, `'VF-ASSIGNED-BY-ADMIN'` fallback).
- **HIGH R-6 · Deposits:** refund not clamped to remaining amount (negative deposit possible); terminal REFUNDED strands partial balances; double-refund protection nominal — final update carries no status predicate and deposit ledger entries take no idempotency keys (`deposit-service.ts:235-368`).
- MEDIUM: bulk rider `accountStatus` silently no-ops yet reports updatedCount; END_RENTAL orphans ACTIVE lease/vehicle; balance-set idempotency key (`admin:${id}:balance:${target}`) swallows legitimate repeat adjustments; primary admin APPROVE emits no outbox notification (riders stuck on HangTight); two contradictory lifecycle orderings (rank map vs state machine) make outcomes path-dependent, SUSPENDED ranks above ACTIVE breaking thresholds; guarantor rejection reasons + audit trail never persisted; incidents have no severity escalation, closer clobbers resolver identity, timestamp IDs collide; score recalc racy last-write-win, `'PENDING'` isn't a KycStatus.
- LOW: rider detail returns raw KycProfile skipping mask/document-view event; incident count omits REPORTED/DISMISSED; forfeit logged as generic UPDATE.

## 4. Fleet & operations

- **HIGH V-1 · Single-vehicle PUT bypasses the vehicle state machine** (only bulk changeStatus validates transitions) ⇒ AVAILABLE→LOST, RETIRED→ACTIVE_RENTAL via one request (`vehicles/route.ts:126`, `vehicle.use-cases.ts:28-32`).
- **HIGH S-1 · `ops_read` grants shift CREATE/UPDATE/DELETE** (single permission check covers GET and mutations; TEAM_LEADER/HUB_MANAGER hold ops_read, only OPERATIONS_ADMIN/HUB_MANAGER hold shifts_manage) ⇒ read-role can rewrite booking capacity fleet-wide (`shifts/route.ts:34-94`).
- HIGH S-2 · Shift delete misses 4 lease statuses AND hard-deletes against Restrict FK ⇒ guaranteed P2003→500 once any history exists.
- MEDIUM: vehicle duplicate-number TOCTOU→500 (should be 409); bulk reassignHub skips hub existence/lease guard/cache invalidation; UI filters are client-side over one page while pagination is server-side (search misses page 2+); undo replays unvalidated PUT and can't restore deletes (invisible `deletedAt` rows); `markForMaintenance` guards only ACTIVE leases; hub DELETE counts soft-deleted vehicles (undeletable via single path, deletable via bulk); duplicate hub names allowed though referenced by name in pricing/pickup.
- **PASS:** rental syncPickup conditional claim; workflow-coverage/operations/fleet endpoints reviewed clean beyond baseline items.

## 5. Support, comms, content

- **HIGH T-1 · Ticket bulk actions bypass the state machine:** `revert` forces OPEN from CLOSED (forbidden transition) via raw updateMany; assignment is last-write-wins with no assignee validation (`support.use-cases.ts:270-324`).
- HIGH F-FAQ · `orderBy:{sortOrder}` targets a nonexistent column (`order Int` is real) — **typecheck fails and `/api/support/faqs` 500s** (`support.use-cases.ts:120` vs schema.prisma:782). This is part of why CI typecheck is red today.
- MEDIUM: announcement scheduled fan-out dup race (SCHEDULED until job flips; Notification lacks uniqueness so skipDuplicates no-ops); ALL-audience confirm+rate-limit skipped when scheduled; `channel:'SMS'` silently never sends SMS; admin reply gated by view-only perm; escalate action advertised in schema but unimplemented → 500; FAQ reorder unsynchronized + PUT can reintroduce duplicates; legal saves go live instantly, revision history unreachable (no draft/publish/restore).
- **PASS:** notifications fan-out branches (minor batch robustness only).

## 6. Observability & infrastructure

- **HIGH I-1 · Manual/"run-now" backup is a silent no-op:** emits `ADMIN_JOB_SCHEDULED_BACKUP` which has **zero registered consumers** in `WORKERS[]` (`data-management.use-cases.ts:85,391`; `workers/index.ts:79-269`) — exact bug class documented as fixed for RENT_DUE_CHECK, reintroduced for backups. Returns 202; row sits PENDING forever.
- **HIGH I-2 · Crashed backup wedges the pipeline forever:** lock has no TTL (`BACKUP_LOCK_STARTED_AT` written, never read); stale RUNNING BackupJob rows block every future attempt (`backup.service.ts:679-761`).
- **HIGH I-3 · Outbox reaper double-executes long jobs:** claims N rows then processes serially; 5-min stale cutoff < real broadcast durations; resume marker lost on reclaim ⇒ already-delivered batches resent to 10k+ riders (`job-queue.ts:103-203`, broadcast job resume parsing).
- MEDIUM: failed scheduled backup retries ~288×/day (failure doesn't advance nextRunAt); analytics monthly trend groupBy exact-timestamp (cost scales with rowcount; comment lies); three inconsistent timezone bucketing conventions incl. a fragile revenue-trend join whose test asserts nothing; telemetry ingestion untyped/unquota'd (unbounded PII table growth per rider); storage tab walks directories synchronously inside requests (event-loop stall); DR drill passes on months-old backups and echoes internal error strings; scheduler fire-once guards memory-only (dup after restart); checksum verification reads whole multi-GB files into RAM.
- LOW: backups POST accepts unvalidated `type` (PRE_RESTORE lock-bypass enum reachable once worker lands); maintenance-mode PUT unvalidated types; metrics route lacks permission tiering + non-constant-time secret compare; hourly cleanup runs 60×.
- **PASS:** dr-drill genuinely prod-isolated/read-only; poison-pill DLQ hygiene solid; no pause/resume mechanism exists (nothing to race — but also no drain path short of restart).

---

## 7. Flutter — "is the app populated with correct data?" (contract verification)

Transport layers: raw `ApiClient` (`_handleResponse` unwraps `{success,data}` **only when data is a Map**; List payloads keep envelope — api_client.dart:780-788) ← generated `VoltiumApiClient` ← legacy `VoltiumApiService`.

| Surface | Endpoint shape | Client parsing | Verdict |
|---|---|---|---|
| Wallet balance (dashboard) | `toRupeesResponse` ⇒ rupees (`flatten-rider.ts:124`) | live cards use rupees directly, **no /100** (`dashboard_normal_wallet_card.dart:43-44`) | ✅ correct |
| Transactions/history | paginated endpoint, rupees | `amountInRupees`, ×100-sum→/100 consistent (`history_screen.dart:99-108`); pager fixed 2026-08-22 (HIST-a) | ✅ correct |
| Plans list | `success(plans[])` — array ⇒ envelope preserved | gates `response['success']` (`choose_plan_screen.dart:54`) | ✅ works (by passthrough) |
| Device verify-lock | `success({success: valid})` | checks inner field after unwrap (`locked_overlay.dart:112-114`) | ⚠️ works **by accident** (server nests literal `success`); fragile |
| Earnings POST | map payload | checks 3 shapes defensively (`earnings_screen.dart:267-269`) | ✅ works |
| **Rewards (points/streak/list)** | `success({...})` map ⇒ **unwrapped** | gates `response['success']` (`engagement_provider.dart:162`) | ❌ **dead in prod** |
| **Referrals** | map payload | same gate (`:182`) | ❌ **dead in prod** |
| **Notifications + unread badge** | `success({notifications, unreadCount})` map | same gate (`:194`) | ❌ **dead in prod** |

**Answer:** No — three engagement surfaces (rewards, referrals, notifications incl. the dashboard unread badge) receive correct server data but discard it due to FL-1; widgets render empty in production. Demo seed (`_loadDummyData`, `engagement_provider.dart:117-149`) is TEST_MODE-only, so prod users see blanks, not fake numbers. Everything else checked populates correctly; money units are rupee-consistent end-to-end on live paths.

**Dead-code landmines (money-display):** `GradientWalletCard`/`MiniWalletCard` (`features/wallet/widgets/wallet_card.dart:124,216` divide rupees by 100 ⇒ 100× underscale) and `ReceiptPreview` (paise assumption + unguarded substring) — zero call sites today; delete before someone mounts them.

---

## 8. Top-10 remediation order (merge into REMEDIATION_PLAN phases)

1. G-1/G-2 admin takeover paths (+G-3 hash strip) — hours
2. M-1/M-2/M-3 same-state loopholes + redeem ×100 — money creation, days
3. R-6 deposit clamp/idempotency + R-3/R-4 KYC CAS + resubmit guard
4. I-1 register backup consumer + I-2 lock/job staleness reaper + I-3 heartbeat/reaper sizing
5. FL-1 envelope contract fix (already planned PR-F)
6. R-5 pickup allowlist restriction; R-1/R-2 rider PUT state machine + encrypt
7. S-1/V-1 permission + state-machine splits (mutations vs reads)
8. F-FAQ sortOrder fix (also unblocks typecheck) + M-6 REFUND reconciliation exclusion
9. M-4/M-5 referral guards + gateway secret masking
10. Bulk-path integrity sweep (tickets revert, riders accountStatus no-op, reassignHub guards)

Full evidence chains live in the auditor transcripts; each finding above cites file:line for direct verification.
