# Audit: Language Section (+ fix plan)

**Date:** 2026-09-08
**Scope:** Flutter l10n (ARBs, generated localizations, `LocaleNotifier`,
persistence, app wiring, selection UI, formatting, server sync) → web
(`preferredLocale` column, validators, notification/SMS/FAQ/legal strings,
admin i18n) → `flutter/test` + `web/tests` coverage.
**Method:** source-only (no docs read). A previous pass already fixed the big
items (server mirror, KYC discriminator push, money grouping, scaffold
script) — each re-verified; the gaps below are what's left.

**Architecture in one line:** Flutter owns everything (2 ARBs × 882 keys,
`LocaleNotifier` + `CacheService` + `PUT /api/rider/profile`,
`Intl.defaultLocale` en_IN/hi_IN); server stores `preferredLocale` as an
opaque string; admin panel has no i18n at all.

---

## Findings

### P1

**P1-1 · Follow-system can never clear the server copy.**
`setFollowSystem` mirrors via `{'preferredLocale': ''}`
(`flutter/lib/core/localization/locale_provider.dart:211`), but the validator
requires `min(2)` + BCP-47 regex with no empty-literal escape
(`web/src/lib/validators.ts:47-52`) — every clear 400s. Net effect as
audited: once set, the server preference is permanent → a rider who switches
back to follow-system keeps syncing the stale language to new devices
(`maybeApplyFromServer` adopts it where no local choice exists).
- Narrowed since audit: the `updateProfile` skip-nulls half is **already
  fixed** — `rider.use-cases.ts:801` carves `preferredLocale` out, and
  `:822-826` writes explicit `null` through unsanitized. And `ApiClient.put`
  uses plain `jsonEncode` (`api_client.dart:531-536`), so `null` survives the
  wire. Remaining work is client sends-`''` → send-`null`, plus defensive
  `''`-means-clear on the server for old builds.

**P1-2 · `maybeApplyFromServer` adopts unsupported locales.** It builds
`Locale(serverPreferredLocale)` with zero allowlist check
(`locale_provider.dart:186-191`), and the server regex accepts *any* two
lowercase letters (`fr`, `zz`). One poisoned/legacy row → `state.locale`
matches neither `isHindi` nor `isEnglish`, `MaterialApp` falls back
unpredictably, dialog shows a raw code. (`_loadSavedLocale` *does* gate on
`supportedLanguages` — this path doesn't.)

**P1-3 · Zero `preferredLocale` coverage in `web/tests`** (grep: 0 hits).
The sync/clear/allowlist contract has no test pinning it — which is exactly
how P1-1 shipped with a comment claiming the opposite ("validator treats
empty as null" — it doesn't).

**P1-4 · Only KYC pushes localize; everything else is English-only.**
Server sends structured discriminator + empty strings for KYC
(`notification-service.ts:118-140`, client renders from ARB — verified
working, incl. reason interpolation). But support-reply, payment-reminder
(`₹${amount.toFixed(2)}` — also wrong grouping for Indian format), reward,
birthday, shift pushes are hardcoded English, as are the SMS OTP template
(single `MSG91_TEMPLATE_ID`) and SOS SMS. Verified client-side: the
foreground `onMessage` handler only renders KYC locally
(`fcm_service.dart:286-304`); every other type displays the OS-rendered
English `notification` block with no localization pass.

### P2

- **FAQ/legal/validators EN-only with no locale column.** `Faq` /
  `LegalDocument` models have no locale field; `/api/support/faqs` has no
  `?locale`. Requires schema + cache-key work — stage after P1-4, or accept
  EN-only help content as a product decision.
- **No onboarding language step.** Discoverable only via Settings/Profile
  post-login. Mitigated: first launch follows system locale automatically.
  Product call.
- **`setLocale` early-return skips re-sync** when re-tapping the active
  language (`locale_provider.dart:115`). Harmless once P1-1 lands; leave.
- **No per-locale goldens.** `wrapForGolden` declares both locales but nothing
  snapshots Hindi rendering — one Hindi golden for the settings screen +
  language dialog would catch layout overflow in Devanagari.
- **Force-unwrap `AppLocalizations.of(context)!`** is the codebase-wide
  convention (100+ sites); delegates are always present in-app. Leave alone.

### Verified good (no action)

- ARB parity 882/882; Hindi leftovers are legitimate brand/format terms
  (English, KYC, UPI, EV Plus, YYYY-MM-DD). System-locale resolution,
  persisted→system→en fallback chain, `displayNameFor` ARB-first with
  nativeName fallback. `formatRupees` Indian grouping correct for both
  locales; `DateFormat('MMM dd')` without explicit locale follows
  `Intl.defaultLocale` (hi_IN data is initialized), so month names do
  localize. `toRupeesResponse` passes `preferredLocale` through untouched
  (verified `api-money.ts:112-141` — non-paise keys recurse/passthrough).
  Plural (`common_pendingSync`) uses `pluralLogic` with the right locale.
  PostHog locale events are PII-free codes. `updateIncidentSchema`-style
  route zod is unrelated — noted only to confirm no locale branching hides
  there (grep: zero `Accept-Language`/`errorMap`/i18n hits in `web/src`).

---

## Fix plan

Conventions: `flutter/` and `web/` roots as prefixed. After every phase:
`flutter analyze` on touched files; `npm run typecheck && npm run lint` in
`web/`. No migrations in Phases 1–3 (P2 FAQ work is the only schema item and
is explicitly optional).

### Phase 0 — Safety baseline (10 min)

1. `git checkout -b fix/language-audit-2026-09-08` (tree is dirty — branch first).
2. Record baselines (all currently green):
   - `flutter test test/providers/locale_provider_test.dart
     test/core/language_mode_comprehensive_test.dart
     test/features/profile/settings_theme_language_dialog_test.dart`
   - `npx vitest --run tests/unit/8-audits-v2-contracts.test.ts`
     (validator-contract pattern to copy in Phase 3).

### Phase 1 — P1-1 clear semantics + P1-2 allowlist gate (45 min)

1. **Client — send `null`, not `''`** (`locale_provider.dart:201-218`):
   ```dart
   await api.put(
     '/api/rider/profile',
     body: {'preferredLocale': code}, // null clears; was code ?? ''
   );
   ```
   (`jsonEncode` preserves null — verified `api_client.dart:531-536`.)
2. **Server — accept `''` as clear for old builds** (`validators.ts:47-52`):
   append `.or(z.literal(''))`, and in `rider.use-cases.ts` normalize
   `''` → `null` next to the existing carve-out (`:822-826`, already writes
   explicit `null` through). Do NOT touch the skip-nulls rule for any other
   key.
3. **Client — gate adopted locales** (`locale_provider.dart:177-192`):
   ```dart
   if (!supportedLanguages.any((l) => l.code == serverPreferredLocale)) return;
   ```
   before constructing the `Locale`. (Mirrors `_loadSavedLocale`'s existing
   gate, `:257-262`.)
4. **Server — tighten the regex toward an explicit set** (`validators.ts:51`):
   `^(en|hi)$` today (keeps the "future language" path honest: adding a
   language becomes a 3-file change — ARB + `supportedLanguages` + this
   regex — instead of an open pipe). Keep `max(8)` for `en_IN`-style tags
   only if the client ever sends them (it sends bare `en`/`hi`; prefer the
   tight enum).
5. Tests: `flutter test test/providers/locale_provider_test.dart` still green
   (no behavior change for supported codes); Phase 3 covers the server side.

**Risk:** near-zero (additive acceptance + one payload literal).
**Verify:** Hindi phone → set Hindi → set Follow system → `GET
/api/rider/profile` shows `preferredLocale: null`; fresh install on second
device follows system instead of stale Hindi.

### Phase 2 — P1-3 backend locale tests (45 min)

New `web/tests/unit/rider-preferred-locale.test.ts`, following the
`8-audits-v2-contracts.test.ts:27-36` `safeParse` pattern (no DB) plus
`@/lib/db` + `@/lib/server-cache` mocks per `admin-kyc-approval-parity.test.ts:48-68`:
1. `updateProfileSchema.safeParse({preferredLocale: 'hi'})` valid;
   `'fr'` — documents the *chosen* policy (valid iff Phase 1 kept the open
   regex, invalid iff tightened; assert whichever was implemented).
2. `''` valid (clear path); `'e'` / `'english'` / `'en-US'` invalid → 400 shape.
3. `updateProfile` with `{preferredLocale: null}` calls
   `db.rider.update` with `{preferredLocale: null}` (mock `db`, assert write
   payload — pins the `:822-826` carve-out against future "cleanup" regressions).
4. `flattenRider` output preserves `preferredLocale` end-to-end (regression
   net for the passthrough).

### Phase 3 — P1-4 localize pushes + SMS (2–4h, staged)

**Stage A — support-reply + payment-due discriminators (2h):**
1. Server (`notification-service.ts:142-166`): mirror the KYC shape —
   `createAndSend(riderId, '', '', 'SUPPORT_REPLY', { screen, ticketId })` and
   `createAndSend(riderId, '', '', 'PAYMENT_DUE', { screen: 'WALLET',
   amountPaise, dueDate })`. Notes: pass **paise int**, never a pre-formatted
   string (fixes the `toFixed(2)` grouping bug by construction); keep
   `subject` out of the payload or re-add it as structured data, not prose.
2. ARB (both files):    `notif_supportReplyTitle/Body` (with `{ticketId}` or app
   name placeholder — decide copy with product; never interpolate the raw
   English subject line into Hindi copy), `notif_paymentDueTitle/Body`
   (`{amount}` formatted client-side
   via `formatRupees`, `{dueDate}` via locale date format). `flutter gen-l10n`,
   confirm 883/883 parity.
3. Client (`notification_service.dart` next to `renderKycPushFromData:207`):
   `renderSupportPushFromData` / `renderPaymentPushFromData` using the same
   `CacheService().getLocale() ?? 'en'` + `lookupAppLocalizations` pattern;
   extend the `onMessage` chain (`fcm_service.dart:295-303`) and the
   background handler (`:610`) with the two new branches; fall through to
   existing render path when data doesn't match (same contract as KYC).
4. Tests: renderer unit tests for en+hi (incl. paise→`formatRupees` amount and
   missing-field fallback); keep an old-payload test proving the fallthrough.
5. Keep FCM `notification` block empty for the migrated types (as KYC does);
   otherwise Android shows English while the app shows Hindi (double
   notification, two languages).

**Stage B — Hindi SMS template (1h, needs MSG91 console work first):**
1. Add `MSG91_TEMPLATE_ID_HI` env + `sms-provider.ts` template picker on a
   `locale` param (`'hi'` → HI template, default EN).
2. OTP SMS stays numeric-first (locale-neutral); translate only the wrapper
   sentence. SOS SMS: same picker, threading the rider's `preferredLocale`
   (already fetched for the rider row in the SOS route).
3. Tests: picker unit test (hi/en/default), no-template-configured fallback
   to EN (never fail the send).

**Stage C — reward/birthday/shift (30 min, same recipe as A):** discriminators
+ ARB + renderer branches. Do only after A proves the pattern in review.

### Phase 4 — P2 batch (product-gated, ~1h + decisions)

1. Hindi golden: settings screen + language dialog via existing
   `wrapForGolden(themeMode…)` harness pattern with `Locale('hi')` (30 min,
   catches Devanagari overflow).
2. Decisions to log (no code until decided): FAQ/legal locale columns
   (schema + `?locale` + cache key — the only migration in this whole plan),
   onboarding language step, EN-only admin (recommend: keep).

### Verification matrix

| Gate | Command / check |
|---|---|
| Analyze + types + lint | `flutter analyze` (touched files); `npm run typecheck && npm run lint` in `web/` |
| Unit | existing locale suites + new `rider-preferred-locale.test.ts` + renderer tests (Stage A) + SMS picker test (Stage B) |
| ARB parity | `flutter gen-l10n` clean; key counts equal en/hi (882→883 after Stage A) |
| Manual (dev) | hi → follow-system → profile shows null → second device follows system; Hindi phone receives Hindi support/payment pushes; airplane-mode locale switch still instant (local-first untouched) |
| Coverage | no drop vs Phase-0 baseline |

**Total: ~4–6h across 4 phases** (Phase 1+2 ≈ 1.5h self-contained; Phase 3
staged behind product copy sign-off; Phase 4 mostly decisions).
