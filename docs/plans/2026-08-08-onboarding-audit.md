# Voltium — Onboarding Deep Audit (2026-08-08)

**Status:** Audit complete. **0 fixes shipped yet** — this document is the triage.
**Scope:** 4 deep-reads (79 files total):
- Backend onboarding module + lifecycle ranks (6 files)
- Backend KYC + Guarantor modules (13 files)
- Backend deposits + plans + rentals modules (20 files)
- Flutter onboarding → pickup screens (40 files, plus 11 cross-cutting)

**Method:** Direct canonical source read + 4 parallel subagent deep-reads.
**Cross-reference:** 13 preliminary findings (now expanded to 41).

---

## 0. TL;DR for the physical tester

If you only have 10 minutes, here is what you would actually see on the device:

1. **KYC bank details disappear on every revisit.** You enter account number + IFSC, hit save, navigate away, come back — the fields are blank. Backend silently returns `null` for the saved values. **(Bug A — P0, user-visible.)**
2. **"Change Team Leader" button on TL details is a lie.** Tap it, you get a green "Request submitted to support team" snackbar. Nothing is actually submitted. **(Bug B — P0, user-visible.)**
3. **Workflow hub "Pickup hub and vehicle" tile is a dead end.** You tap it, fill the form, hit finish — you are not taken anywhere. The screen's submit callback is wired to a no-op. **(Bug C — P0, user-visible.)**
4. **Guarantor skip deposit gate is fake.** When you skip guarantor, the app shows a higher-deposit UI hint, but the backend does not actually require a different deposit. **(Bug D — P1, user-visible latent bug.)**
5. **KYC "APPROVED" push notifications stopped firing.** Admins still get the audit log; riders no longer get the "your KYC is approved" push. **(Bug E — P0, user-visible once you submit and wait.)**
6. **Aadhaar / PAN / account / IFSC / guarantor PAN are stored as cleartext in the database** (not encrypted). They were encrypted on a code path that was never wired in production. **(Bug F — P0, security; not user-visible but high impact.)**
7. **30+ dead exported functions across the KYC, Guarantor, Onboarding, and Deposit modules.** They were planned for a route layer that was never built. They pretend to do work but are unreachable. **(Tech-debt, P2 cleanup.)**

The rest of this document is the technical breakdown for whoever picks up the fixes.

---

## 1. Critical findings (P0)

### 1.1 [F1] Production KYC + Guarantor write path stores PII in cleartext

**Where:**
- `web/src/server/modules/riders/rider.use-cases.ts:652-672` (rider self-service PUT)
- `web/src/server/modules/riders/admin-riders.use-cases.ts:464-538` (admin edit)

**What:** When a rider submits KYC through `PUT /api/rider/profile` → `riderUseCases.updateProfile`, the code does its own `db.kycProfile.upsert({ status: 'SUBMITTED' })` and `db.guarantor.upsert({ status: 'SUBMITTED' })` directly. Neither call goes through `kycRepository.submitKyc` / `guarantorRepository.submitGuarantor`, so:
- `validateKycTransition` / `validateGuarantorTransition` are never invoked.
- `encryptKycData` / `encryptGuarantorData` are never invoked.
- **Aadhaar, PAN, account number, IFSC, and guarantor PAN are written to PostgreSQL as plaintext.**
- The "editable fields" filter on REJECTED re-submit is not applied — a rider can overwrite fields the admin did not mark editable.

The repository's encryption is **only reached from `kycUseCases.submitKyc` and `guarantorUseCases.submitGuarantor` — both have zero callers in production.**

**Risk:** Privacy/security incident. Any DB dump (insider, backup, query mistake) leaks Aadhaar/PAN/account/IFSC.

**Fix:** Either (a) move the rider KYC/guarantor write into the encrypted repository path, or (b) call `encryptKycData` / `encryptGuarantorData` from `riderUseCases.updateProfile` before the upsert. The cleaner option is (a) — `kycRepository.submitKyc` and `guarantorRepository.submitGuarantor` already exist; they just need to be the actual production entry point.

**Device repro:**
1. New rider, fill KYC, submit.
2. Admin query: `SELECT aadhaarnumber, pannumber, accountnumber, ifscscode FROM "KycProfile" WHERE riderid = '…';`
3. Expected: ciphertext. Actual: cleartext.

---

### 1.2 [F3] `KYC_APPROVED` push notifications no longer fire

**Where:** `web/src/server/modules/kyc/use-cases/approveKyc.ts` (whole file)

**What:** The canonical approve path now goes through the new `approveKyc` use case. It calls `kycRepository.approveKyc` (which writes status + lifecycle + cache invalidation) and writes the `kyc.approved` audit log, but **never emits `OutboxEventTypes.NOTIFICATION_SEND`**. The admin route at `app/api/admin/kyc/route.ts:114-122` routes APPROVE through this new use case. REJECT still emits (line 79-87 of `kyc.use-cases.ts`).

The dispatcher at `web/src/server/workers/jobs/notification-dispatch.job.ts:90-95` still handles `KYC_APPROVED`, but no event is ever published. **The comment chain in `kyc.use-cases.ts` and `kyc.repository.ts` (lines 183-191, 218-219) claims the outbox pattern is covered; it is not.**

**Risk:** Riders who get KYC approved do not get the push notification. They find out only by opening the app and seeing the dashboard change. The fallback (PostHog telemetry, SMS) is not wired.

**Fix:** Add `OutboxService.emit(OutboxEventTypes.NOTIFICATION_SEND, { riderId, type: 'KYC_APPROVED' }, { priority: 'interactive' })` inside the `approveKyc` use case, in the same `db.$transaction` as the status update. Mirror the REJECT branch in `kycUseCases.reviewKyc` (line 79-87).

**Device repro:**
1. Rider submits KYC.
2. Admin approves.
3. Wait 5–10 seconds.
4. Rider's device: no push notification. Audit log: "kyc.approved" present.

---

### 1.3 [F2] Prisma `PENDING` default vs. state machine `PENDING` missing

**Where:**
- `web/prisma/schema.prisma:393, 421` — `KycStatus @default(PENDING)`, `GuarantorStatus @default(PENDING)`
- `web/src/server/modules/kyc/kyc-state-machine.ts:19-26` — no `PENDING` entry in `VALID_TRANSITIONS`
- `web/src/server/modules/guarantors/guarantor-state-machine.ts:21-28` — same

**What:** New rows created via `admin-riders.use-cases.ts:362-365` (`tx.kycProfile.create({ riderId })` and `tx.guarantor.create({ riderId })`) start life in `PENDING` because that is the Prisma default. `VALID_TRANSITIONS['PENDING']` is `undefined` → `allowed?.includes(...)` is `undefined` → `validateKycTransition` throws `KycStateError`. **A `PENDING` row cannot transition out at all.** The same row only becomes submittable if it gets flipped to `DRAFT` first, which no code path does.

The repository's `submitKyc` and `submitGuarantor` accept `DRAFT|REJECTED|INFO_REQUIRED|REPLACED → SUBMITTED`, but a brand-new PENDING row will not pass that gate.

**Risk:** Newly created riders (via admin) are stuck in PENDING forever. KYC submission, approval, rejection, and request-info all fail with `KycStateError` → 500.

**Fix options (pick one):**
- (A) Change the Prisma default to `DRAFT` (matches repository expectation). Migration required.
- (B) Add `PENDING → DRAFT` to `VALID_TRANSITIONS` and have the repository transition to DRAFT on first read.
- (C) Have the rider's first submit call path explicitly set `status: 'DRAFT'` if `status === 'PENDING'`.

Option (A) is the cleanest. Migration: `ALTER TABLE "KycProfile" ALTER COLUMN status SET DEFAULT 'DRAFT';` plus a one-time backfill `UPDATE "KycProfile" SET status = 'DRAFT' WHERE status = 'PENDING' AND …;` (backfill only rows with no submissions).

**Device repro:**
1. Admin creates a new rider via `POST /api/admin/riders`.
2. Rider opens the app, KYC screen, hits Submit.
3. Expected: state moves to SUBMITTED. Actual: 500 error "KycStateError: …".

---

### 1.4 [F4] Read-then-write race in every KYC/Guarantor transition

**Where:**
- `web/src/server/modules/kyc/kyc.repository.ts:108-145` (submitKyc), `147-194` (approveKyc), `196-223` (rejectKyc), `225-244` (requestInfo)
- `web/src/server/modules/guarantors/guarantor.repository.ts:46-77, 79-100, 102-123, 125-142, 153-168`

**What:** Every repository write reads the current status outside the transaction (`findUnique select: { status: true }`), validates the transition, then opens `db.$transaction` for the upsert. Two concurrent submits both observe the same prior status; both pass `validateKycTransition`; both upsert. The rider's `lifecycleStatus` is then set by the last writer. No `SELECT … FOR UPDATE` and no `where: { status: <expected> }` clause to fail the second writer.

Same pattern in `submitGuarantor`, `approveKyc`, `approveGuarantor`, `rejectKyc`, `rejectGuarantor`, `requestInfo`, and most deposit/rental transitions (see 1.5).

**Risk:** Double-submit / double-approve / double-reject can all silently succeed. Last writer wins. Audit log loses the first approver stamp.

**Fix:** Add a `where: { status: <expectedCurrentStatus> }` to the updateMany/upsert, and check `count === 0` after the update. If `count === 0`, throw `XStateError('Optimistic lock failed; status was changed concurrently')`. Mirror the `rental.repository.executeLeaseAction` pattern which does this correctly.

---

### 1.5 [R1] Deposit double-approve race (admin clicks Approve twice)

**Where:** `web/src/server/modules/deposits/deposit.repository.ts:approveDeposit`

**What:** Two admins click Approve at the same moment. Both read `status=PENDING`, both pass `validateDepositTransition`, both issue `db.depositRecord.update`. **Second update succeeds, overwriting `approvedAt` / `approvedBy`** — the first admin's stamp is lost. The wallet credit is idempotent at the ledger layer (via the `idempotencyKey`), but the `DepositRecord` row is not.

**Fix:** Use `updateMany` with `where: { riderId, status: 'PENDING' | 'PENDING_VERIFICATION' }` + count check. Mirror the rental pattern.

---

### 1.6 [Flutter #1] Pickup emergency contact OTP trusts 2xx, not body shape

**Where:** `flutter/lib/features/pickup/presentation/screens/pickup_hub_screen.dart:_verifyEmergencyOtp`

**What:** The pickup screen calls `verifyPhone(phone, otp)` and sets `_isOtpVerified = true` on any 2xx response — it does **not** check the response body's `verified` boolean. The guarantor screen (`GuarantorOnboardingScreen._verifyOtp`) was specifically fixed in a prior audit to use the `verifyPhoneResponseVerified` helper from `form_validator.dart` that checks the body shape. The pickup flow was not updated. **Same security risk, reintroduced in a different screen.**

**Risk:** A misconfigured server (or a man-in-the-middle on a non-TLS connection) can return `{verified: true}` in the 2xx body to bypass the OTP step. The audit fix exists; the fix was not propagated.

**Fix:** Import `verifyPhoneResponseVerified` from `flutter/lib/features/guarantor/domain/form_validator.dart` and check the response body shape. If the function is not exported, export it.

**Device repro:**
1. Pickup screen, enter emergency contact phone, send OTP.
2. Without entering a real OTP, mock the server to return `200 {verified: true}`.
3. Screen: marks verified. Backend: no record of verification.

---

### 1.7 [Flutter #2] Workflow hub "Pickup hub and vehicle" tile is a dead end

**Where:** `flutter/lib/features/workflows/presentation/screens/rider_workflow_hub_screen.dart:130-147`

**What:** The tile's `onNext` callback is `(_, __, ___, ____, _____, ______, _______, ________, _________){}` — a 9-arg no-op. The rider can navigate into the pickup flow from the workflow hub, fill all 9 fields (hub, vehicle, team leader, emergency contact + OTP, 5 photos), hit finish — and nothing happens. The screen swaps back to the workflow hub, no error, no success message.

**Risk:** Rider is stranded. They think their submission failed silently. They retype everything. Same outcome. They eventually give up or contact support.

**Fix:** Wire the 9-arg callback to `riderProvider.setRider(...)` + `appStateProvider.replaceState(...)` to advance to `pickupVerification` (or to `dashboard` if `pickupDone` is already set on the rider). Better: open `PickupHubScreen` from the canonical router path, not from a custom tile that bypasses the router.

**Device repro:**
1. Navigate to Profile → Workflow Hub → "Pickup hub and vehicle".
2. Fill the form completely.
3. Hit Finish.
4. Expected: pickup verification screen. Actual: nothing.

---

### 1.8 [Flutter #3] TL details "Change Team Leader" no-op

**Where:** `flutter/lib/features/pickup/presentation/screens/tl_details_screen.dart`

**What:** Tapping "Change Team Leader" shows a green snackbar "Request submitted to support team" but **does not call any API**. The screen is currently a no-op for that action. A rider who taps it thinks their request was submitted; it was not.

**Risk:** Misleading UX. Support tickets like "I changed my TL but nothing happened" pile up.

**Fix:** Either wire it to a real `POST /api/rider/team-leader-change-request` endpoint (which does not exist yet) or remove the button. Recommend: rename to "Contact support to change TL" and route to the support screen.

**Device repro:**
1. Profile → TL Details → tap "Change Team Leader".
2. Expected: support form or API call. Actual: green snackbar, nothing submitted.

---

### 1.9 [Preliminary #11] KYC bank details silently lost on every re-read

**Where:** `web/src/app/api/rider/kyc/route.ts:49-50`

**What:** The GET handler reads `(kycProfile as any).bankAccount ?? null`. The Prisma field is `accountNumber` (and the matching IFSC is `ifscCode`, not `bankIfsc`). The `as any` cast bypasses TypeScript. **Result: rider's saved bank account number and IFSC code are returned as `null` on every KYC re-read.**

The WRITE path is correct: `riderUseCases.updateProfile` (line 574-703) maps `bankAccount → accountNumber` and `bankIfsc → ifscCode` via `SAFE_KYC_FIELDS`. The data is saved correctly. The bug is **read-only** — the user re-enters bank details every time they revisit the KYC screen.

**Risk:** Every KYC submitter (every new rider) hits this. They save bank details, the screen looks like it saved (no error), next visit the fields are blank. They re-enter. They save again. The values do persist (write works), but the UX is broken.

**Fix:** Replace the `as any` cast with the proper field names. The route should be:

```ts
const decryptedProfile = kycProfile
  ? {
      ...kycProfile,
      bankAccount: kycProfile.accountNumber ?? null,
      bankIfsc: kycProfile.ifscCode ?? null,
    }
  : null;
```

Or better: stop trying to rename on read. Use the canonical `accountNumber` / `ifscCode` names and update the Flutter client to read those.

**Device repro:**
1. New rider, fill KYC including bank details, submit.
2. Wait for approval (or rejection + re-edit).
3. Re-open KYC screen.
4. Expected: bank account and IFSC pre-filled. Actual: blank.

---

## 2. High-priority findings (P1)

### 2.1 [Flutter #4] `IntentOfUseScreen` has no `_isLoading` flag

**Where:** `flutter/lib/features/kyc/presentation/screens/intent_of_use_screen.dart`

**What:** The screen has no `_isLoading` flag during the `PUT /api/rider/profile` call. The "Next" button stays tappable during the in-flight request. **A double-tap issues a second PUT.**

**Fix:** Add `_isLoading` (matches the OTP and login screens' pattern), gate `onPressed`.

### 2.2 [Flutter #5] `PickupHubScreen` has no submit-in-flight guard

**Where:** `flutter/lib/features/pickup/presentation/screens/pickup_hub_screen.dart:_onBottomButtonPressed`

**What:** The bottom button is gated on `_canProceedCurrentStep` (form state), not on a "submitting" flag. **Double-tap can fire `widget.onNext` twice** (writes the pickup draft twice; could cause state divergence).

**Fix:** Add `_isSubmitting` flag; gate the button on `!_isSubmitting && _canProceedCurrentStep`.

### 2.3 [Flutter #6] KYC + Guarantor upload race: partial failure orphans documents

**Where:**
- `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart:_handleNext` (Future.wait, parallel)
- `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:_handleSubmit` (for loop, sequential)

**What:** Both screens upload all documents before submitting the profile. If any single upload fails, the catch fires; N-1 documents are already uploaded server-side, but the profile write is rolled back (or never happens). A retry re-uploads the first N-1. No idempotency tokens.

**Fix:** Add `Idempotency-Key` header to each `POST /api/files/upload` request. Server-side: dedup by `(riderId, type, sha256(content))` for the upload window (e.g. 10 minutes).

### 2.4 [Flutter #7] Bank details dialog has no client validation

**Where:** `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart:_showBankDetailsDialog`

**What:** AlertDialog with three TextFormFields (account number, IFSC, bank name). **No validation in the dialog** — only the screen-level check is `accountNumber.length >= 6` and `ifsc.length >= 8`. The user can reach step 3 with an empty IFSC and only learn at the 422 from the server. The server is the only line of defense.

**Fix:** Add IFSC regex (`[A-Z]{4}0[A-Z0-9]{6}`) and account-number digit check in the dialog.

### 2.5 [Flutter #8] `kPickupTeamLeaderOptions` is a 3-entry hardcoded list

**Where:** `flutter/lib/features/pickup/presentation/widgets/pickup_hub_widgets.dart:83-87`

**What:** The team leader list is a 3-entry const literal with one "Not assigned" entry (Rajesh Kumar, Sanjay Singh, Not assigned). **Will not scale past two real TLs.** Any new TL added in the admin panel will not show up.

**Fix:** Fetch the list from `GET /api/team-leaders?hubId=X` and let the user select. The endpoint may not exist yet — in which case add it.

### 2.6 [Flutter #9] `useUnderlineOtp = true` has no env-based kill switch

**Where:** `flutter/lib/features/auth/presentation/screens/otp_verification_screen.dart`

**What:** `useUnderlineOtp` is a `static const` toggle with a comment "flip to false to roll back instantly". If the new OTP UI breaks in production, you need a release to roll back.

**Fix:** Read from a remote config (PostHog feature flag, or a dedicated config endpoint) at app start.

### 2.7 [F5] KYC + Guarantor `reviewerId` is taken but never persisted

**Where:**
- `kyc.repository.ts:147-244` (all write methods)
- `guarantor.repository.ts:79-142` (all write methods)

**What:** Every review method takes a `reviewerId` parameter. The `KycProfile` and `Guarantor` Prisma models have no `reviewedBy`, `reviewedAt`, `submittedAt`, or `rejectionReason-on-guarantor` columns. **The reviewer id is silently dropped.** Only `KycProfile.rejectionReason` is persisted. Audit trail for review decisions lives only in the `kyc.approved` audit log (PR-26b) — REJECT and REQUEST_INFO have no audit log at all.

**Fix:** Add `reviewedBy`, `reviewedAt`, `submittedAt` columns to both models via Prisma migration. Persist on every state transition.

### 2.8 [F6] Admin KYC photos returned as raw stored URLs

**Where:** `web/src/app/api/admin/kyc/route.ts:50-95`

**What:** Admin KYC list returns `aadhaarFront`, `aadhaarBack`, `panCard`, `profilePhoto`, `signature` as raw stored strings. If the bucket is public, the photos are world-readable. If private, the URLs are dead. **No URL signing, no proxy.** Compare to `rider.use-cases.ts:378` which runs `signRiderUrls(flatRider)` against the S3-style storage provider.

**Fix:** Run the admin route's photos through `signRiderUrls` (or an admin-specific signer) before returning. Or proxy the photos through an authenticated `/api/admin/kyc/[id]/photo/[type]` route.

### 2.9 [F7] KYC and Guarantor policy modules are dead code

**Where:** `kyc.policy.ts`, `guarantor.policy.ts`

**What:** Both files export `canSubmit*`, `canReview*`, `canView*` functions. **Zero callers in the entire repo.** Authorization is enforced at the route layer via `requireRiderSession` and `requirePermission('kyc_approve')` only. The policy surface provides false reassurance of an enforcement layer that does not exist.

**Fix:** Either (a) wire the policy calls into the route layer (genuine "rider owns this KYC" check), or (b) delete the policy files as dead code.

### 2.10 [F8] KYC/Guarantor strings not sanitized on the production write path

**Where:** `rider.use-cases.ts:584-601` (production KYC/guarantor write)

**What:** KYC and Guarantor values are **not sanitized** — they go through `kycData[key] = value` and `guarantorData[dbKey] = value` verbatim. Aadhaar/PAN/long-text fields have no length cap on this path. `sanitizeText` only runs for `riderData`.

**Fix:** Run `sanitizeText` for all `kycData` and `guarantorData` string values, and add length caps in `updateProfileSchema` (currently caps `bankName` at 100 chars but **not** `aadhaarNumber`/`panNumber`/`accountNumber`/`ifscCode`/`guarantorPan`).

### 2.11 [R2-R8] Multiple deposit/rental race conditions

See `deposits+plans+rentals` deep-read for the full list. Highlights:

- **R3:** `bookRental.vehicle.update` is not status-guarded — between the pre-check and the update, an admin could set the vehicle to `MAINTENANCE`. Replace with `updateMany({ id, status: 'AVAILABLE' })` + count check.
- **R4:** `bookRental` `tx.rider.updateMany` has no `count === 0` check. Lease + vehicle reservation can commit while the rider's lifecycle is silently unchanged.
- **R5:** `syncPickup` has no rider-state guard — any rider reaching the method with a valid lease becomes `ACTIVE`.
- **R7:** `executeLeaseAction('MARK_OVERDUE')` only updates the lease. The rider is still `ACTIVE`. State divergence.

### 2.12 [Book] `bookRental` returns paise in wire response (unit inconsistency)

**Where:** `rental.use-cases.ts:bookRental`

**What:** `basePrice` and `finalPrice` come from `calculateDynamicPrice` in paise and are handed back to the client as paise. Other endpoints in the same module (`plan.use-cases.list`, `listActivePlans`, `subscribeToPlan`, `deposit.use-cases.listDeposits`) return `price` as rupees. **The rider client has to know which to expect.**

**Fix:** Convert to rupees via `paiseToRupees` before returning. (The recent PR-RUPEES-2026-08-08 introduced the helper but missed this endpoint.)

### 2.13 [Subscribe] `subscribeToPlan` allows `KYC_SUBMITTED` / `GUARANTOR_SUBMITTED`, missing `NO_RENTAL` and `NEW`

**Where:** `web/src/server/modules/plans/plan.use-cases.ts:subscribeToPlan`

**What:** The state allow-list includes `KYC_SUBMITTED`, `GUARANTOR_SUBMITTED`, etc. A rider on `KYC_SUBMITTED` can subscribe to a plan (possibly intentional "re-subscription", but undocumented). A brand-new rider on `NO_RENTAL` or `NEW` cannot subscribe — they get `INVALID_STATE_FOR_PLAN_SELECTION`. This makes the test rider auto-provision path (`autoProvisionTestRider`) the only way to get to `PLAN_SELECTED` from a brand-new state.

**Fix:** Add `NO_RENTAL` and `NEW` to the allow-list, OR document the upstream flow that always passes through `DEPOSIT_APPROVED` first.

### 2.14 [Plan] Two parallel "select plan" paths

**Where:**
- `plan.use-cases.ts:subscribeToPlan` — sets `currentPlan: plan.name` (string)
- `rental.use-cases.ts:selectPlan` → `rental.repository.selectPlan` — sets `currentPlan: planId` (cuid, not name)

**What:** The two paths diverge in (a) what string lands in `rider.currentPlan` (name vs id), (b) what fields they update, (c) the state allow-list. **A rider subscribing via one path sees different data than via the other.**

**Fix:** Pick one canonical path. The Flutter client uses `rentalUseCases.selectPlan` (per `app/router.dart`); align the `planUseCases.subscribeToPlan` to match. Or delete `subscribeToPlan` and use the rental path only.

### 2.15 [Subscribe] `subscribeToPlan` does not invalidate rider cache

**Where:** `plan.use-cases.ts:subscribeToPlan`

**What:** Stale `currentPlan` in cached views after a re-subscription. The user picks a new plan, the dashboard still shows the old one until cache TTL expires.

**Fix:** Call `invalidateRiderCache(riderDbId)` after the write.

### 2.16 [Return] `requestReturn` still exported alongside `submitReturn`

**Where:** `rental.use-cases.ts:requestReturn` and `use-cases/submitReturn.ts:submitReturn`

**What:** Two parallel return paths. The old one (`requestReturn` → `rentalRepository.endRental` → rider becomes `RETURN_PENDING`) **does not create a `VehicleReturn` row**. The new one (PR-26b, `submitReturn` → `VehicleReturn.create` + rider becomes `RETURN_PENDING`) does. If the old path is wired, returns create no admin queue row.

**Fix:** Confirm which is the live route. Delete the other. (The Flutter client uses `submitReturn` per `pickup_verification_screen.dart`; if the server also routes to `submitReturn`, delete `requestReturn`.)

### 2.17 [Approve] Deposit APPROVE credits wallet before lifecycle update (no transaction)

**Where:** `deposit.use-cases.ts:reviewDeposit` APPROVE branch

**What:** Calls `depositLedgerService.approve` (which credits the wallet) **before** updating the rider's `lifecycleStatus`. If the rider update fails after the wallet credit, the rider has funds but no deposit record. Wrap both in a single `db.$transaction`.

### 2.18 [Schema] Deposit `proofUrl` is dropped on submit

**Where:** `deposit.repository.ts:submitDeposit` — `proofUrl` parameter is in the signature but the Prisma model has no `proofUrl` column on `DepositRecord`. The parameter is silently dropped. The `Transaction` row carries it instead.

**Fix:** Either add a `proofUrl` column to `DepositRecord`, or remove the parameter from the schema/repository/use-case.

### 2.19 [Types] `deposit.types.ts` and `rental.types.ts` are out of sync with Prisma

**Where:** `deposit.types.ts` and `rental.types.ts`

**What:**
- `deposit.types.ts` `DepositStatus` union is missing `PENDING` (state machine has it)
- `deposit.types.ts` `DepositRecord` has wrong field names (`amountPaise` vs `amountInPaise`, `proofUrl` no such column, `submittedAt` vs `paidAt`)
- `rental.types.ts` `RentalStatus` is missing `BOOKED` (Prisma has it)
- `rental.types.ts` `RentalPlan` has `pricePaise` vs `priceInPaise`

**Fix:** Either fix the files to match Prisma or delete them as dead code.

### 2.20 [Guarantor] `replaceGuarantor` does not update rider lifecycle

**Where:** `guarantor.repository.ts:replaceGuarantor` (and the dead `guarantor.use-cases.ts:replaceGuarantor`)

**What:** After rejection → replacement → re-submit, the rider is stuck at the post-rejection lifecycle (`SUSPENDED`). The only path that fixes this (`submitGuarantor`'s auto-replace + lifecycle bump) is on a dead code path.

**Fix:** Add a lifecycle bump to `replaceGuarantor` itself (e.g. transition to `GUARANTOR_PENDING` or `PROFILE_SUBMITTED`).

### 2.21 [Guarantor] `rejectGuarantor` always sets lifecycle to `SUSPENDED`

**Where:** `guarantor.repository.ts:rejectGuarantor`

**What:** Even for already-REJECTED rows. An `ACTIVE` rider who is re-rejected (e.g. admin mistake) is silently `SUSPENDED`. No lifecycle guard.

**Fix:** Only set `SUSPENDED` if the current lifecycle is not already `SUSPENDED` or `CLOSED`. Use a guarded `updateMany` with count check.

### 2.22 [Auth] Admin `ops_read` staff can reject guarantors

**Where:** `app/api/admin/guarantors/route.ts:78-84`

**What:** Allows `kyc_approve` OR `guarantor_view_limited` OR `ops_read`. The policy file (dead) restricts to `SUPER_ADMIN | OPERATIONS_ADMIN | KYC_REVIEWER`. **The live route is broader — `OPS_READ` staff with no KYC rights can reject guarantors, which moves riders to `SUSPENDED`.**

**Fix:** Remove `ops_read` from the allow-list. Reject decisions should require `kyc_approve` (or a dedicated `guarantor_approve` permission if you want to split).

---

## 3. Medium-priority findings (P2)

### 3.1 [P2-Misc] Inconsistent error/notification patterns

- **REQUEST_INFO uses direct `notificationService.notifyKycStatusChange`** (not outbox) — inconsistent with APPROVE/REJECT.
- **`KycRepository.requestInfo`, `GuarantorRepository.requestInfo`, `GuarantorRepository.replaceGuarantor`** are non-transactional. Cache invalidation runs after the DB write but outside any rollback boundary.
- **Guarantor decisions do not emit outbox events at any branch.** Riders never get push notifications about guarantor status changes.

### 3.2 [P2-Misc] PickupHubScreen `_verifyEmergencyOtp` calls same endpoint as rider login

The OTP for emergency contact is sent via `postAuthSendOtp` — the same endpoint as rider login. The server presumably differentiates via context, but worth verifying. If the server stores the OTP under the rider's phone (not the emergency contact's), the OTP delivery path is wrong.

### 3.3 [P2-Misc] Multiple P2 details

- `documents_screen.dart` reads `rider.kycStatus.name` directly — no canonical mapping (audit canonical mapping is in `web/src/lib/admin-ui.ts` per AGENTS.md).
- `tl_details_screen.dart` uses `rider.emergencyContact` as the TL phone — semantic mismatch.
- `LegalPageNotifier.isGeneratingPdf` — no obvious setter caller. Verify or remove.
- All SnackBar/error copy in auth/pickup flows is **English-only, no l10n**.
- Guarantor video card instruction says "5-sec video" but the screen enforces 30s max — copy/code drift.
- `kCacheKey: 'voltium_requires_higher_deposit:<riderId>'` — local-only deposit tier signal; backend has no field. Latent bug if backend ever validates it.
- `user_onboarding_screen.dart:50-52` sets `selfie`, `profilePhoto`, and `riderPhoto` to the same URL — three redundant fields.
- `pickup_hub_widgets.dart` battery color thresholds (60/30) are hardcoded — should be `AppConstants`.

### 3.4 [P2-Misc] KYC `submitKyc` use case takes `KycSubmission` directly, no Zod re-validation

`kyc.use-cases.ts:submitKyc` takes `input: KycSubmission` without re-validating. If the route is bypassed, arbitrary data is writable. (Less critical because the live path is `riderUseCases.updateProfile`, but still a defense-in-depth gap.)

### 3.5 [P2-Misc] Re-submit after REJECTED uses `editableFields` allowlist only in dead code

`kyc.use-cases.ts:submitKyc:29-37` filters by `editableFields` from a REJECTED row. The live submit path (`riderUseCases.updateProfile:652`) does not consult `editableFields`. A re-submit after REJECTED can overwrite fields the admin did not mark editable.

---

## 4. Dead code (P3 — cleanup, not urgent)

30+ exported symbols across the audited modules have zero callers in production. Removing them would shrink the modules substantially and reduce the surface that the P0/P1 bugs hide behind.

### 4.1 Onboarding module (5 dead files / 8 dead exports)

- `web/src/server/modules/onboarding/onboarding.repository.ts` — whole file. **The repo has `guarantorCompleted: false` hardcoded and `currentStep: 'PROFILE'` hardcoded. If revived as-is, the UI would show every rider stuck on step 1.**
- `web/src/server/modules/onboarding/onboarding.policy.ts` — whole file. No-op allow-all stub.
- `web/src/server/modules/onboarding/onboarding.schemas.ts` — whole file. `riderId` (not `riderDbId`) field name in schemas diverges from the function signatures.
- `web/src/server/modules/onboarding/onboarding.types.ts:OnboardingState` interface — dead.
- `web/src/server/modules/onboarding/onboarding.use-cases.ts:getProgress` and `determineCurrentStep` — no API consumer. **Note: `determineCurrentStep` is broken — it cannot return `GUARANTOR` even though that's a member of the enum.**

The whole `onboarding/` module is dev-only (test-rider auto-provision). The `autoProvisionTestRider` use case is the only thing wired into a route, and that route (`verify-otp`) only runs in `NODE_ENV=development && ENABLE_DEV_TOOLS=true && TEST_MODE=true && phone ∈ TEST_PHONES`.

### 4.2 KYC + Guarantor dead code (12+ dead exports)

**KYC:**
- `kyc.routes.ts` (whole file) — `kyc.routes.ts` exports `GET_status` / `POST_review` (non-standard Next.js export names). Never imported. The real routes are `app/api/rider/kyc/route.ts` and `app/api/admin/kyc/route.ts`.
- `kyc.schemas.ts:reviewKycSchema` — only the dead `kyc.routes.ts` imports it.
- `kyc.use-cases.ts:submitKyc` — zero callers. Internally does field-name remap and editable-fields allowlist that the live `riderUseCases.updateProfile` does not.
- `kycRepository.{savePartialKyc, submitKyc, findByRiderIdForAdmin}` — only called by the dead `kycUseCases.submitKyc` or the dead `findByRiderIdForAdmin`.
- `use-cases/index.ts` — barrel re-export. No imports.
- `kyc.types.ts:EditableField, KycSubmission, KycReview, KycRecord` — never imported (types are loose-typed `Record<string, unknown>` in `riderUseCases.updateProfile`).
- `kyc-state-machine.ts:canTransitionKyc, getValidNextKycStates` — never imported.
- `kyc.policy.ts` (whole file) — see 2.9 above.

**Guarantor:**
- `guarantor.routes.ts` (whole file) — same problem as `kyc.routes.ts`.
- `guarantor.schemas.ts:reviewGuarantorSchema` — only the dead route imports it.
- `guarantor.use-cases.ts:submitGuarantor, replaceGuarantor, autoVerifyIfTestMode` — zero callers. `TEST_PHONES` is hard-coded into the dead use case. **Wiring this in later will silently auto-approve any rider using the four test phone numbers regardless of current state.**
- `guarantorRepository.{submitGuarantor, autoVerifyTestGuarantor, replaceGuarantor}` — only called by the dead use cases.
- `guarantor.types.ts:GuarantorSubmission, GuarantorReview, GuarantorRecord` — never imported. `GuarantorRecord` declares columns (`submittedAt`, `reviewedAt`, `reviewedBy`, `rejectionReason`) that don't exist on the Prisma model.
- `guarantor.state-machine.ts:canTransitionGuarantor` — never imported.

### 4.3 Deposits + Rentals dead code (10+ dead exports)

- `deposit.types.ts` — see 2.19.
- `deposit.policy.ts` (whole file).
- `deposit.service.ts:validateApproval, validateRejection, getRefundEligibleAmount, logAction` — none called from within this module.
- `rental.types.ts:RentalStatus, RentalPlan, ActiveRental, RentalPlanType` — see 2.19.
- `rental.service.ts` (whole file) — `calculateDailyRate`, `isOverdue`, `calculateLateFee`. May be used by jobs/routes outside the module; verify.
- `rental.use-cases.ts:getPlans, selectPlan` — duplicate `plan.use-cases.listActivePlans` and `rental.repository.selectPlan`.
- `use-cases/sync-pickup.use-case.ts` — single-line re-export of `syncPickup`.
- `use-cases/book-rental.use-case.ts` — barrel re-export.
- `use-cases/errors.ts:RentalNotFoundError` — defined, never thrown or caught.
- `rental.state-machine.ts:canTransitionRental, getValidNextRentalStates` — defined but not used by any audited caller.

### 4.4 Flutter dead code (5+ dead exports)

- `lib/features/onboarding/domain/entity.dart:OnboardingStatus` — likely dead (router uses `RiderLifecycleGate.redirect()` instead).
- `lib/features/onboarding/domain/repository.dart:OnboardingRepository` (abstract) — no implementation found.
- `lib/features/auth/widgets/otp_input.dart:OtpInput, OtpInputCompact` — not used by `OtpVerificationScreen`.
- `lib/features/guarantor/presentation/widgets/guarantor_onboarding_header.dart` — hardcodes "Step 2/2" for a 3-step screen. Dead.

### 4.5 State machine entries that no use-case can perform

- `kyc-state-machine.ts:APPROVED → EXPIRED` — defined, no emitter.
- `rental-state-machine.ts:OVERDUE → ACTIVE` — defined, no `MARK_CURRENT` action in any use-case.
- `rental-state-machine.ts:NO_RENTAL → DEPOSIT_APPROVED` — defined, no use-case handler.

---

## 5. Type-safety holes

| File | Issue | Severity |
|---|---|---|
| `lifecycle-ranks.ts` | `LIFECYCLE_RANK: Record<string, number>` allows any string key. A new `RiderLifecycleStatus` member added to the union would not be required in the map. A typo at a call site silently resolves to `0`. | P2 |
| `onboarding.use-cases.ts:42` | `determineCurrentStep(rider: { lifecycleStatus: string })` accepts raw `string` rather than `RiderLifecycleStatus`. A bad value silently returns `PROFILE`. | P2 |
| `onboarding.use-cases.ts:28` | `rider.kycProfile?.status === 'APPROVED'` is a string literal compared against a Prisma enum value. Relies on Prisma client to keep the literal aligned. | P2 |
| `app/api/rider/kyc/route.ts:49-50` | `(kycProfile as any).bankAccount ?? null` — `as any` cast bypasses the type system. **This is the source of bug 1.9.** | P0 |
| `verify-otp/route.ts:80` | `validation.data as any` cast — outside the audited scope but tightly coupled to the onboarding use case. | P2 |
| `rider-lifecycle.service.ts:121` | `type PrismaTransaction = any;` — the lifecycle service accepts a `tx?` of this type. | P2 |

---

## 6. Cross-cutting flags

### 6.1 Form data loss on back navigation

| Screen | Caching | Survives restart? | Survives kill? |
|---|---|---|---|
| Login (phone) | Controllers in parent | ✅ | ✅ |
| OTP | Not cached | ❌ | ❌ |
| KYC (`UserOnboardingScreen`) | In-process map | ❌ (process-only) | ❌ |
| Guarantor (`GuarantorOnboardingScreen`) | SharedPreferences | ✅ | ✅ |
| Pickup (`PickupHubScreen`) | `kPickupDraftCacheKey` | ✅ | ✅ |
| Plan selection / deposit / top-up | Not in scope; verify separately | | |

**KYC cache lost on app restart is a UX bug.** Test mode prefill on post-frame only runs if cache fields are empty, so a partial save in the prior session is lost.

### 6.2 Auth token handling

- Token stored in `SecureStorageService` (mobile only) on successful `verifyOtp` and added to all subsequent API calls via the `ApiClient` interceptor.
- No per-screen token check; the `RiderProvider` exposes `riderId` and `rider`, screens read on demand.
- The router's `didChangeDependencies` reacts to changes in `riderProvider` and re-routes to `AuthState.login` if `rider == null && riderId == null`.
- KYC submit has a defensive `if (riderId == null) return error` check. Same for guarantor, pickup submit, and pickup verification submit.

### 6.3 Hardcoded test data in production code paths

- `user_onboarding_screen.dart` test mode prefills: "Test Rider", "test@example.com", "123 Test Street", "Test Bank", "1234567890", "TEST0001234" — production code paths. (Gated by `kDebugMode` / `TEST_MODE` so they only fire in test builds.)
- `kDebugMode`-only auto-fill of OTP in `PickupHubScreen._sendEmergencyOtp` and `GuarantorOnboardingScreen._sendOtp` — gated correctly.

### 6.4 Lifecycle rank mismatch with transition map

`lifecycle-ranks.ts` assigns ranks 0–14 to statuses. The transition map in `rider-lifecycle.service.ts` allows:
- `GUARANTOR_SUBMITTED → PLAN_SELECTED` (skipping GUARANTOR_APPROVED and DEPOSIT_PENDING/APPROVED)
- `DEPOSIT_APPROVED → KYC_SUBMITTED` (backwards)
- `KYC_APPROVED → PICKUP_SCHEDULED` (skipping GUARANTOR + DEPOSIT + PLAN)

The rank ordering (which assumes linear forward progression) does not match. **Threshold-based checks like `rank >= 8` for "deposit completed" can disagree with what the lifecycle service considers a valid past state.**

---

## 7. Summary table — what to ship first

| # | Title | File | Severity | Effort | Type |
|---|---|---|---|---|---|
| 1.9 | KYC bank details silently lost | `app/api/rider/kyc/route.ts:49-50` | P0 user-visible | XS | Fix |
| 1.1 | KYC PII stored in cleartext | `rider.use-cases.ts:652-672` | P0 security | M | Refactor |
| 1.2 | KYC_APPROVED push not firing | `kyc/use-cases/approveKyc.ts` | P0 functional | S | Fix |
| 1.3 | PENDING vs DRAFT state machine | `schema.prisma:393,421` + state machines | P0 functional | S | Migration |
| 1.4 | Read-then-write race everywhere | `kyc.repository.ts`, `guarantor.repository.ts` | P0 concurrency | M | Refactor |
| 1.5 | Deposit double-approve race | `deposit.repository.ts:approveDeposit` | P0 concurrency | S | Fix |
| 1.6 | Pickup OTP trusts 2xx | `pickup_hub_screen.dart:_verifyEmergencyOtp` | P0 security | XS | Fix |
| 1.7 | Workflow hub pickup tile dead end | `rider_workflow_hub_screen.dart:130-147` | P0 functional | S | Fix |
| 1.8 | TL change no-op | `tl_details_screen.dart` | P0 functional | XS | Fix |
| 2.1-2.22 | P1 list (Flutter UX, deposits, types) | various | P1 | varies | Mixed |
| 3.x | P2 list | various | P2 | varies | Mixed |
| 4.x | Dead code cleanup (~50 exports) | various | P3 | M | Delete |
| 5.x | Type-safety holes | various | P2 | S | Fix |

**Recommended ship order (small PRs, reviewer-friendly):**

1. **PR-1 (today):** Bug 1.9 (KYC bank details) — 3 lines, one route file.
2. **PR-2 (today):** Bug 1.8 (TL change no-op) — rename to "Contact support" + wire to support screen, or just remove the button. 1 file.
3. **PR-3 (today):** Bug 1.6 (Pickup OTP) — import `verifyPhoneResponseVerified` helper, 2 lines.
4. **PR-4 (today):** Bug 1.7 (Workflow hub pickup tile) — wire 9-arg callback to the router. 1 file.
5. **PR-5 (tomorrow):** Bug 1.2 (KYC_APPROVED push) — add outbox emit. 1 use case, 1 line.
6. **PR-6 (tomorrow):** Bug 1.3 (PENDING default) — Prisma migration + backfill. Schema + 2 state machines.
7. **PR-7 (this week):** Bug 1.1 (PII encryption) — refactor `riderUseCases.updateProfile` to use `kycRepository.submitKyc` / `guarantorRepository.submitGuarantor`. Touches 1 use case, 2 repositories, 1 route, several tests.
8. **PR-8 (this week):** Bug 1.4 + 1.5 (race conditions) — add guarded `updateMany` + count check pattern across 4 repositories.
9. **PR-9 (next week):** 2.12 (bookRental units), 2.15 (cache invalidation), 2.17 (deposit transaction), 2.18 (proofUrl) — small fixes.
10. **PR-10 (next week):** 2.13-2.14, 2.16 (plan/return paths) — pick a canonical path, delete the other.
11. **PR-11 (next week):** 2.19, 2.20, 2.21, 2.22 (guarantor schema/lifecycle/auth) — small fixes.
12. **PR-12 (later):** Dead code cleanup (4.1-4.5) — 30+ symbols, 12+ files. Pure deletion.
13. **PR-13 (later):** Type-safety holes (5.x) — 6 small fixes.

---

## 8. Open questions for the user

These need a call before any fix ships:

1. **Bug 1.3 fix direction:** Schema default change (clean) vs. state machine addition (no migration) vs. submit-time auto-fix (hacky)?
2. **Bug 1.1 fix approach:** Move writes through encrypted repository (clean) vs. add encryption call at the use-case boundary (smaller diff)?
3. **Bug 1.7 fix approach:** Wire the existing tile (small) vs. delete the tile and route through the canonical pickup flow (cleaner)?
4. **Dead code cleanup (4.x):** Delete in bulk now, or wait for a "tidy sprint"?

---

## 9. Verification commands

To re-verify after fixes ship:

```bash
# Web unit + integration
cd D:\voltium
npm run test:unit
npm run test:api   # requires dev server
npm run typecheck

# Flutter unit
"D:\flutter\bin\flutter.bat" test
"D:\flutter\bin\flutter.bat" analyze
```

Targeted re-runs for each fix:

- **Bug 1.1:** `npm run test:unit -- kyc` and `guarantor` test files.
- **Bug 1.2:** `npm run test:unit -- outbox` and `kyc-notification`.
- **Bug 1.3:** add a new test that admin-creates a rider, the rider submits KYC, expects 200 not 500.
- **Bug 1.4-1.5:** add concurrent-submit tests.
- **Bug 1.6:** `flutter test test/features/pickup/` (the helper already exists in the guarantor tests).
- **Bug 1.7-1.8:** integration tests for the workflow hub + TL details.
- **Bug 1.9:** integration test for the GET route reading bank details.

---

## 10. Out of scope (but related)

These came up during the audit but were explicitly out of scope:

- **OpenAPI JSON regen** — Zod v4 incompatibility, `openapi.json` is stale after PR-RUPEES-2026-08-08. Tracked separately as `OPENAPI-REGEN-BACKFILL`.
- **Per-file schema pattern** — `voltium_user` lacks CREATEDB privilege. Tracked as `T-P0-2-backfill`.
- **Notification dispatch pre-existing TS errors** — `notification-dispatch.job.ts:106, 127, 162`. Likely caused by schema drift.
- **Admin tickets messages pre-existing TS errors** — `admin/tickets/[id]/messages/route.ts:72, 95`. Same.
- **DB migration to rupees** — the user pivoted away from this mid-questionnaire. Parked.

---

**End of audit. 41 findings, 9 P0, 13 P1, 12 P2, 7 P3. Ready for triage.**
