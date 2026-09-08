# Edit Profile Audit — findings + fix plan (code-only, no docs read)

**Scope (source only):** Flutter `features/profile/presentation/screens/edit_profile_screen.dart` (now ~1694 lines), `widgets/edit_profile_widgets.dart`, `domain/repository.dart`, `data/repository_impl.dart`, sibling readers `profile_screen.dart` / `profile_detail_screen.dart`, `utils/app_constants.dart` (`resolveProofUrl`), server `app/api/rider/profile/route.ts`, `lib/validators.ts` (`updateProfileSchema`), `server/modules/riders/rider.use-cases.ts` (allowlists + `updateProfile`), `lib/verify-receipt.ts`, `app/api/auth/verify-phone/route.ts`, tests `flutter/test/profile/edit_profile_screen_test.dart`, `web/tests/unit/profile-audit-p0-p1.test.ts`, `web/tests/unit/verify-receipt.test.ts`.

**Flow:** form seeded from `riderProvider` → dirty-tracked controllers → optional photo upload → `PUT /api/rider/profile` (`UpdateProfileRequest`) → Zod strict schema → allowlist split (rider/KYC/guarantor) → single Prisma `$transaction` → `refreshFromApi` → pop. Guarantor phone changes additionally require send-OTP → verify-OTP → signed receipt.

> **Tree-status note (2026-09-08):** prior passes today already implemented large
> parts of this audit (marked ✅ below with file:line evidence). The plan in
> Part 2 covers only what is genuinely still open, plus regression pins.

---

## Part 1 — Findings

**What's solid:** strict Zod schema (`.strict()`); three-layer allowlists plus unknown-field warn logging (`rider.use-cases.ts:803-819`); atomic transaction with in-tx re-reads and CAS lifecycle transitions (`:1178-1196` single fresh read, first-submission-only KYC moves); KYC approved-lock + fail-closed editable allowlist with cosmetic/identity split and default-deny on empty allowlist (`:976-1020`); mandatory OTP receipt for new/changed guarantor phones with rider binding (`:1118-1147`, `verify-receipt.ts:66-136`); server-side 18+ DOB, 10-digit and self-number checks mirroring the client; photo upload before PUT with `cacheWidth` decode; dirty-gated save + localized discard dialog (`:855-878`); per-keystroke listener list correctly excludes the OTP box (`:445-456`); `ref.read` (not `watch`) in event handlers; unchanged-guarantor server no-op with surcharge/lifecycle protection (`:1064-1109`); receipt rider-scoping with cross-rider rejection message (`verify-receipt.ts:110-115`).

---

## P0 — must fix

### P0-1. Photo upload failure strands `_isSaving = true` with a dead Save button
- **Withdrawn — actually handled** (outer catch resets `_isSaving`). Replace with the real issue:

### P0-1 (real). Uploaded photo is orphaned when the PUT fails — and a failed PUT still consumed the upload
- ✅ **FIXED in tree.** `edit_profile_screen.dart:726-731` declares `uploadedPhotoUrl` outside the try; catch block at `:803-816` best-effort deletes via `riderRepo.deleteUploadedFile`. Distinct failure messaging handled under P2-2.

### P0-2. Guarantor receipt binds to the *typed* digits, server binds to the *stored* digits — formatting drift can brick save
- ✅ **Structurally closed, one pin left.** Issuance is canonical by construction: `verify-phone` route schema requires `^\d{10}$` (`verify-phone/route.ts:13-16`), so `issueVerifyReceipt` can only ever bind exact 10 digits; client strips to digits before both send and verify; `verify-receipt.test.ts` already pins "receipts only validate against the 10-digit form". The `+91` drift hypothesized here **cannot occur through this route**.
- **Remaining:** a route-level contract test that `+919…`/spaced variants 400 at verify-phone schema (not just unit-level receipt checks) — see Plan Phase 1.

### P0-3. `guarantorStatus` is rider-writable through edit profile
- ✅ **FIXED in tree.** Removed from `SAFE_GUARANTOR_FIELDS` (`rider.use-cases.ts:235-239`) and from `updateProfileSchema` (`validators.ts:169-177`, strict schema now rejects it as unrecognized). Client never sent it.

### P0-4. DOB: client picker and server regex accept different formats, and server throws raw `Error` → generic 500 path
- ✅ **FIXED in tree.** Validation sites throw `RiderValidationError`; route maps it to 409 with the real message (`profile/route.ts:81-89`); client renders 409 bodies verbatim via the P2-2 allowlist (`edit_profile_screen.dart:818-840`).

## P1 — high

### P1-1. `updateProfile` in `RiderRepository` doesn't exist — the screen bypasses the repository layer entirely
- ✅ **FIXED in tree.** `riderRepo.uploadProfilePhoto` (`edit_profile_screen.dart:742`), `riderRepo.updateProfile` (`:760`), `riderRepo.deleteUploadedFile` (`:812`) — no inline `ApiClient()` construction left on the save path.

### P1-2. Emergency-contact and guarantor-phone validation is client-formatted, server-absolute — 10-digit hard assumption breaks international formats
- ✅ **FIXED in tree.** Central `isValidIndianMobile` shared by client OTP gate (`edit_profile_screen.dart:543-547`), emergency validator, Zod `.refine` (`validators.ts:93,137-147`), and `lib/phone.ts:25` server helper.

### P1-3. Stale-seed form: controllers snapshot rider once in `initState`, never resubscribe
- ✅ **FIXED in tree.** `ref.listen` rebase via `_rebaseFromServer` (`edit_profile_screen.dart:461-483`); untouched fields rebase silently, touched fields flag conflict.

### P1-4. `riderPhoto` mirrors `profilePhoto` on every save, unconditionally
- ✅ **FIXED in tree.** Alias removed; `profilePhoto` only (`edit_profile_screen.dart:779-787`).

### P1-5. Guarantor OTP resend is client-side only — cooldown + "verified" reset on rebuild
- ✅ **FIXED in tree.** Receipt + verified phone backed by `guarantorVerificationProvider` (rider-scoped; cleared on rider-id change, `edit_profile_screen.dart:71,109,475-483`).

### P1-6. Unchanged-number path trusts a purely local flag
- ✅ **Safe by construction, verified.** Server treats identical payloads as no-ops (`rider.use-cases.ts:1064-1109`, normalized compare) and still demands a receipt for anything changed. No action.

## P2 — medium

- **P2-1. Two `ApiClient()` instances per save** — ✅ fixed (see P1-1).
- **P2-2. Raw server text rendered to users** — ✅ fixed (allowlist + generic fallback, `:826-840`).
- **P2-3. Email regex duplicated and divergent** — ✅ fixed (client aligned to server `z.email()` semantics with `..` guard, `:1047-1060`).
- **P2-4. Phone controller asymmetry** — ✅ fixed (documented read-only exclusion, `:424-427`).
- **P2-5. Unchanged guarantor resubmission round-trips** — ✅ fixed (client skips matching keys `:748-778`, server no-ops `:1064-1109`).
- **P2-6. `EditProfileAdminNote` copy overpromises.** 🔶 **OPEN.** Still reads "Most profile changes require admin approval before becoming active. Emergency contact is updated immediately." (`edit_profile_widgets.dart:44-51`, hardcoded English) — but the PUT path applies name/email/address/emergency/photo immediately. Reconcile copy with reality (and localize it — see P2-9).
- **P2-7. Lifecycle side effect on edit** — ✅ verified no-action (prune precedes transition).
- **P2-8. Avatar `Image.file` has no `errorBuilder`** — ✅ fixed (`:1349-1350`).
- **P2-9. Hardcoded English strings outside l10n** — 🟡 **Mostly fixed** (discard dialog, `txtdiscard` key, OTP toasts use ARB keys with fallbacks). **Remaining:** sweep for stragglers — `EditProfileAdminNote` (P2-6), section headers (see P3-2), PIN-mismatch/deletion toasts cited in audit need a grep-pass to confirm.
- **P2-10. Test file asserts a stale button key** — no action (key matches); real gaps below.

## P3 — low

- **P3-1.** `_twoDigits` vs inline `padLeft` — trivial dedupe, still present (`:486-488`). 5 min.
- **P3-2.** Section headers hardcoded caps — call sites already pass `l10n.txtpersonalDetails.toUpperCase()` (`:1001`); confirm guarantor header matches, else align. 10 min.
- **P3-3.** Permission flags rider-writable — ✅ fixed (removed from schema, `validators.ts:181`).
- **P3-4.** Return/profile coupling — noted, no action (client never sends return fields from this screen).

## Test gaps (current status)

1. Changed-number without receipt → 400 "verify first" — ❌ **OPEN** (server behaviors covered: KYC lock, empty allowlist, unchanged no-op in `profile-audit-p0-p1.test.ts` (5 tests); receipt *binding* covered in `verify-receipt.test.ts` (12 tests) — but the edit-profile receipt-required gate itself has no test).
2. Receipt bound to rider A rejected for rider B — ✅ covered (`verify-receipt.test.ts`).
3. KYC APPROVED + photo save → 400 locked — ✅ covered (`profile-audit-p0-p1.test.ts`).
4. INFO_REQUIRED empty allowlist → fail-closed — ✅ covered.
5. Unchanged guarantor no-op — ✅ covered.
6. Widget OTP-gated save / receipt-missing toast — ❌ **OPEN** (blocked earlier by missing seam; seam now exists — see plan).
7. Widget DOB floor + 17yo actionable message — ❌ **OPEN**.
8. Widget mid-edit rebase banner — ❌ **OPEN** (`edit_profile_screen_test.dart` covers render/dirty/discard/validation only).

---

## Part 2 — Fix plan (remaining work only)

Conventions: `flutter/` and `web/` roots as prefixed. After every phase:
`flutter analyze` on touched files; `npm run typecheck && npm run lint` in
`web/`; relevant suites from Phase 0 baselines below. No migrations in this
plan.

### Phase 0 — Safety baseline (10 min)

1. `git checkout -b fix/edit-profile-audit-remainder-2026-09-08` (tree is dirty — branch first).
2. Record baselines (all currently green):
   - `flutter test test/profile/edit_profile_screen_test.dart`
   - `npx vitest --run web/tests/unit/profile-audit-p0-p1.test.ts web/tests/unit/verify-receipt.test.ts`

### Phase 1 — P0-2 issuance pin + gap-1 server test (30 min)

1. `web/tests/unit/verify-phone-route.test.ts` (new; follow the
   `8-audits-v2-contracts.test.ts:27-36` `safeParse` pattern — no DB needed):
   - `+919876543210`, `91 98765 43210`, `98765 43210` (spaced) → schema rejects (400 shape).
   - `9876543210` → accepted; `issueVerifyReceipt` output verifies via `verifyVerifyReceipt` for the identical string.
   - Rationale to state in a code comment: issuance canonicality is enforced at the route schema, not inside `issueVerifyReceipt` (which is format-agnostic by design for pickup reuse) — the test pins the composition.
2. `web/tests/unit/profile-audit-p0-p1.test.ts` (extend, mocked `db` + `server-cache` per existing file): changed guarantor number without `guarantorPhoneReceipt` → rejects with the exact "verify the new number with OTP first" message (gap 1). Assert the 409-mapped message string, not just the throw.
3. Run both files. **Risk:** none (tests only). **Verify:** green.

### Phase 2 — P2-6 copy + P2-9 string sweep (45 min)

1. `edit_profile_widgets.dart:44-51` — replace the note with honest copy, e.g. "Profile details update immediately. Identity documents and guarantor changes may need verification." Move to ARB (`txteditProfileNote`) + `hi` translation; keep the `??` English fallback per file convention.
2. Grep-pass for remaining hardcoded user-visible strings in `edit_profile_screen.dart` (discard/OTP/guarantor/PIN/deletion paths cited in audit): for each, either an existing ARB key or a new `txt…` key in both ARBs + regen (`flutter gen-l10n`) + parity check (882/882 convention).
3. P3-2 alongside: confirm guarantor section header uses the same `l10n.…toUpperCase()` pattern as `:1001`; align if not. P3-1 `_twoDigits` dedupe (use `_formatDob` parts or inline `padLeft`).
4. `flutter test test/profile/` green; `gen-l10n` diff shows only additions.

### Phase 3 — Widget gap tests 6/7/8 (1.5h, unblocked by the now-existing seam)

Prerequisite (already true): `RiderRepository.updateProfile` is injectable via `riderRepositoryProvider` — fake it; no other seam work needed.
1. **Gap 6:** seed rider + type new guarantor phone → tap save → assert re-verify toast, no PUT; then fake verified receipt → save proceeds (assert `updateProfile` called with `guarantorPhoneReceipt` set).
2. **Gap 7:** DOB picker floor is today−18y (assert `firstDate`/`lastDate` via widget predicate or `showDatePicker` capture); server 17yo → 409 message rendered (mock repo throw `ApiException(409, 'Rider must be at least 18…')`, assert toast text, not generic fallback).
3. **Gap 8:** pump with rider A, push rider B (changed `id`) through the provider → assert conflict banner appears and untouched controllers rebase while a dirtied field keeps its text.
4. Keep the existing 6 widget tests green; do not alter production code in this phase unless a test exposes a real bug (file it, don't bundle).

### Verification matrix

| Gate | Command / check |
|---|---|
| Analyze + types + lint | `flutter analyze` (touched files); `npm run typecheck && npm run lint` in `web/` |
| Unit/widget | Phase-0 baselines + new issuance/contract tests + 3 widget tests |
| ARB parity | key counts equal en/hi after Phase 2 |
| Manual (dev) | changed guarantor number → verify → save succeeds; verify-phone with `+91` prefix → 400; Hindi locale shows translated note |
| Coverage | no drop vs Phase-0 baseline |

**Total: ~2.5–3h across 3 phases**, each independently shippable. The P0/P1 security core is already landed — this plan is pins, copy, and the widget tests the old code couldn't support.
