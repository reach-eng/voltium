# Workflows Deferred Fix Plan — 2026-08-28

**Date:** 2026-08-28
**Source:** The 4 PRs in `fix/workflows-polish-2026-08-28` (PR-A..PR-D, shipped 2026-08-28) intentionally deferred 3 items. This plan covers those.
**Total effort:** ~2 days focused, 3 PRs.
**PR ordering:** PR-F (logging) → PR-E (T-95 + N-2 split) → PR-G (KYC l10n)

---

## 0. Executive summary

Three items were left open by the 4-PR polish batch:

1. **fcm_service.dart logging** — the file uses `dart:developer`'s `developer.log()`, but the rest of the codebase (93 files) uses `appDebug` from `app_logger.dart`. This is a regression introduced by commit `0e25d4d6` (deep-audit remediation, 2026-08-XX) and PR-C/PR-D preserved the drift. **Mechanical fix: revert the file to `appDebug` to match the project standard.** ~0.25 day.

2. **T-95 (4xx-vs-transient classification)** — the workflows audit's T-95 was supposed to add a retry contract to `notificationService.createAndSend`: 4xx → permanent (ack), 5xx / network → rethrow for the job-queue backoff. The audit claimed this was shipped (PR-5, 2026-08-23), but the code shows the generic `catch (error) { return { success: false, error } }` is still in place. **This is a real gap that the audit re-verification missed.** ~0.5 day. Also refines the N-2 PostHog counter added in PR-C: split `fcm_push_error` into `fcm_push_dead_lettered` (4xx) and `fcm_push_transient_error` (5xx / network).

3. **P2-12 (KYC l10n)** — `notificationService.notifyKycStatusChange` currently sends English strings ("KYC Approved! ✅", "Your documents have been verified...", "Your KYC was rejected: ..."). Hindi riders see English copy in their KYC push notifications. **Fix is a cross-stack refactor**: server sends a type discriminator + structured data instead of pre-formatted English; Flutter's `notification_service.dart` decodes the type and looks up the ARB string. ~1 day.

The 3 PRs (PR-F / PR-E / PR-G) ship in this order: lowest-risk first, biggest blast radius last.

---

## 1. PR-F: fcm_service.dart logging consistency

### 1.1 The bug

`flutter/lib/services/fcm_service.dart` uses `developer.log(...)` from `dart:developer`. The rest of the codebase (93 of 95 Dart files that log) uses `appDebug(...)` from `lib/utils/app_logger.dart`, which routes through a configured `Logger` (PrettyPrinter in debug, SimplePrinter in release, with `kDebugMode` level gating).

`appDebug` is the project standard. The fcm_service.dart is the outlier. Commit `0e25d4d6 "fix(flutter): deep-audit remediation"` (around 2026-08-XX) made the change. PR-C and PR-D preserved the drift.

**User-visible impact:** FCM service log lines print in raw `developer.log` format (no tag, no pretty-print, no level gating) on a debug device. On a release build, `appDebug` is gated to `Level.info`+ but `developer.log` always prints. So the production rider app may be emitting stray `[FCM: ...]` lines to logcat that the rest of the app suppresses.

### 1.2 Files to change

- `flutter/lib/services/fcm_service.dart` (1 file)
  - Replace `import 'dart:developer' as developer;` with `import '../utils/app_logger.dart' show appDebug;`
  - Replace every `developer.log('...')` with `appDebug('...')` (use `git grep` to count — should be ~25 call sites in this file alone).

### 1.3 Fix sketch

```dart
// Before:
import 'dart:developer' as developer;
// ...
developer.log('FCM: Rejected payload with missing/invalid action');

// After:
import '../utils/app_logger.dart' show appDebug;
// ...
appDebug('FCM: Rejected payload with missing/invalid action');
```

### 1.4 Test plan

- Source-grep test: `flutter/test/services/fcm_service_test.dart` — new test that asserts:
  - The file imports `appDebug` from `app_logger.dart`
  - The file does NOT import `dart:developer` (i.e. the `developer.log` drift is gone)
  - `appDebug(` appears at least 20 times (matches the previous `developer.log(` count + headroom)
- All existing 17 fcm_service tests must continue to pass.

### 1.5 Acceptance criteria

- `grep -c 'developer\.log' flutter/lib/services/fcm_service.dart` returns 0
- `grep -c 'appDebug' flutter/lib/services/fcm_service.dart` returns ~25
- `flutter analyze --no-pub lib/services/fcm_service.dart` is clean
- Existing 17 fcm_service tests still pass

### 1.6 Reviewer focus notes

- The change is purely cosmetic for log output. No behavior change for the rider.
- Verify the import path: `'../utils/app_logger.dart'` (the file is at `lib/services/fcm_service.dart`, so one `..` up to `lib/`, then `utils/app_logger.dart`).
- The `developer.log` import in the file was at line 7; the `appDebug` import goes in the same position. Watch for duplicate import statements.

### 1.7 Risk

Low. Pure logging refactor. No business-logic change. The `appDebug` helper is already used in 93 other files in the codebase, so the behavior is well-known.

### 1.8 Rollback

Revert the commit. The `developer.log` form is equivalent for `appDebug`'s behavior in non-debug mode; both print to logcat. No migration concern.

---

## 2. PR-E: T-95 (4xx-vs-transient) + N-2 PostHog counter split

### 2.1 The bug

The workflows audit's T-95 (audit §2.4, "KYC decision duplicated in-app + retry contract defeated") claimed the `createAndSend` 4xx-vs-transient classification was shipped in PR-5 (2026-08-23). I re-verified the code and the fix is **not** in place:

```ts
// web/src/lib/notification-service.ts:56-59 (current state)
} catch (error) {
  logger.error('[NotificationService] Error:', error);
  // N-2 (PR-C, 2026-08-28 workflows polish): surface FCM delivery
  // failures to PostHog so the on-call engineer can see the rate
  // of dead-letter / transient errors without grepping logs.
  posthog.capture('fcm_push_error', { ... });
  return { success: false, error };
}
```

The T-95 intent was:

```ts
} catch (error) {
  const status = (error as { code?: string | number; status?: number }).code
    ?? (error as { status?: number }).status;
  const isPermanent =
    typeof status === 'number' && status >= 400 && status < 500;
  if (isPermanent) {
    logger.warn('[NotificationService] FCM 4xx — permanent, acking without retry', { riderId, status });
    posthog.capture('fcm_push_dead_lettered', { ... });
    return { success: false, error, permanent: true };
  }
  logger.error('[NotificationService] FCM transient error — rethrowing for backoff', error);
  posthog.capture('fcm_push_transient_error', { ... });
  throw err;
}
```

Without T-95, **every FCM failure (4xx, 5xx, network) is acked without retry** — a rider who unsubscribed or uninstalled will keep getting their FCM tokens billed at the backend forever, and a 503 from Firebase will be silently acked instead of triggering the job-queue backoff.

The dispatcher's return-value contract is also unused: `notification-dispatch.job.ts:91-105` (KYC_APPROVED case) doesn't check `result.permanent` or whether the result is a thrown error. It just returns `{ delivered: true, channel: 'fcm+in-app', result: approvedResult }`.

### 2.2 Files to change

- `web/src/lib/notification-service.ts` (1 file)
  - Add 4xx-vs-transient classification in the catch block
  - Refine the N-2 PostHog counter to use `fcm_push_dead_lettered` vs `fcm_push_transient_error`
  - Document the `permanent: true` return shape

- `web/src/server/workers/jobs/notification-dispatch.job.ts` (1 file, read-mostly)
  - Confirm the dispatcher passes through rethrows (it already does — the try/catch is at the job-queue layer above). Add a log line that says which path was taken (permanent vs rethrown) for traceability.

- `web/tests/unit/notification-service-dead-letter.test.ts` (1 file, update)
  - Split the single test into 3: 4xx → `fcm_push_dead_lettered` + `permanent: true`, 5xx → `fcm_push_transient_error` + rethrow, network → `fcm_push_transient_error` + rethrow.

- `web/tests/unit/workers/notification-dispatch.job.test.ts` (1 file, add)
  - Add a runtime test that the KYC_APPROVED case lets a rethrown error propagate (so the job-queue backoff engages).

### 2.3 Fix sketch

```ts
// web/src/lib/notification-service.ts (catch block in createAndSend)
} catch (error) {
  const err = error as { code?: string | number; status?: number; message?: string };
  const status = err.code ?? err.status;
  const isPermanent =
    typeof status === 'number' && status >= 400 && status < 500;

  if (isPermanent) {
    // 4xx — bad token, unregistered device, invalid payload. The
    // token won't get any better; acking without retry is correct.
    logger.warn(
      '[NotificationService] FCM 4xx — permanent, acking without retry',
      { riderId, status, type }
    );
    posthog.capture(
      'fcm_push_dead_lettered',
      {
        riderId,
        title,
        type,
        status,
        error: err.message ?? String(error),
      },
      riderId,
    );
    return { success: false, error, permanent: true };
  }

  // 5xx or network — retry. Re-throw so the job-queue backoff
  // engages. The OutboxEvent stays PENDING / PROCESSING and will
  // be retried on the next poll cycle.
  logger.error(
    '[NotificationService] FCM transient error — rethrowing for backoff',
    { riderId, status, type, err: err.message }
  );
  posthog.capture(
    'fcm_push_transient_error',
    {
      riderId,
      title,
      type,
      status: status ?? 'unknown',
      error: err.message ?? String(error),
    },
    riderId,
  );
  throw error;
}
```

The dispatcher is unchanged structurally — the rethrow propagates up through the dispatcher's switch, the dispatcher's outer try/catch (or the job-queue's, if there isn't one) acks the OutboxEvent appropriately. **Verify** with a test that the rethrow does propagate.

### 2.4 Test plan

- **`tests/unit/notification-service-dead-letter.test.ts`** (rewrite):
  - 4xx test: mock `fcmService.sendPushNotification` to reject with `{ code: 404, message: 'Requested entity was not found.' }`. Assert: `result.success === false`, `result.permanent === true`, `posthog.capture` called with `fcm_push_dead_lettered`.
  - 5xx test: mock to reject with `{ code: 503, message: 'Service Unavailable' }`. Assert: `createAndSend` throws (rejection), `posthog.capture` called with `fcm_push_transient_error`.
  - network test: mock to reject with a generic `Error('socket hang up')` (no `code` or `status` field). Assert: throws, `fcm_push_transient_error`.

- **`tests/unit/workers/notification-dispatch-unknown-type.test.ts`** (new or update existing):
  - Add a test that a rethrown `createAndSend` error propagates through the dispatcher's process() and reaches the job-queue layer. The simplest assertion: `expect(() => dispatchJob.process({...})).rejects.toThrow()`.

- Source-grep test that the T-95 marker comment is in the file (it was originally a comment marker convention used by the audit).

### 2.5 Acceptance criteria

- `createAndSend` returns `{ success: false, permanent: true }` on 4xx
- `createAndSend` rethrows on 5xx and network
- PostHog event `fcm_push_dead_lettered` fires on 4xx
- PostHog event `fcm_push_transient_error` fires on 5xx / network
- Dispatcher let the rethrow propagate (verified by runtime test)
- All 17 existing fcm_service tests still pass (no Flutter change)
- All 22 web tests from the polish batch still pass

### 2.6 Reviewer focus notes

- The 4xx check is `status >= 400 && status < 500`. FCM's API returns 400 / 403 / 404. Verify the magic number is documented.
- The PostHog event name split means anyone with a PostHog insight on `fcm_push_error` (added in PR-C) will need to update the filter to `fcm_push_error*`. Add a note in the migration log.
- The `permanent: true` field is the new return-shape extension. The dispatcher's contract for this field is "this is a perma-failure; do not retry". The current dispatcher doesn't use it, but future dispatcher work (T-95 follow-up) can.

### 2.7 Risk

Medium. Behavior change in the failure path. A 4xx that's currently acked (correct) and a 5xx that's currently acked (wrong) will now be acked (correct) and retried (correct). The PostHog event name change requires monitoring dashboard updates.

### 2.8 Rollback

Revert the commit. The catch block returns to the generic shape. PostHog insights may show no events for `fcm_push_dead_lettered` / `fcm_push_transient_error` but `fcm_push_error` (the old name) will start firing again.

---

## 3. PR-G: P2-12 KYC l10n (cross-stack)

### 3.1 The bug

`web/src/lib/notification-service.ts:62-73` sends pre-formatted English KYC strings in the push notification body:

```ts
async notifyKycStatusChange(riderId: string, status: string, reason?: string) {
  const title = status === 'APPROVED' ? 'KYC Approved! ✅' : 'KYC Update Required ⚠️';
  const message =
    status === 'APPROVED'
      ? 'Your documents have been verified. You can now proceed to pick up your vehicle.'
      : `Your KYC was rejected: ${reason || 'Please re-upload your documents.'}`;
  return this.createAndSend(riderId, title, message, 'KYC_UPDATE', {
    screen: 'KYC_STATUS',
    status,
  });
},
```

A Hindi rider whose Flutter device locale is `hi` sees English text in their KYC push. Same for `SUPPORT_REPLY`, `PAYMENT_DUE`, `REWARD`, etc. — but the workflows audit singled out KYC because (a) it's the most user-visible decision, (b) it has the highest-stakes copy, and (c) the audit's T-91 (KYC_INFO_REQUESTED fix) is the natural sibling to the l10n fix.

The proper fix is a **cross-stack refactor**: the server stops sending pre-formatted English; it sends a discriminator + structured data. The Flutter client decodes the discriminator and renders the localized string via ARB.

### 3.2 Files to change

- `web/src/lib/notification-service.ts` (1 file)
  - `notifyKycStatusChange` sends `{ type: 'KYC_APPROVED' | 'KYC_REJECTED' | 'KYC_INFO_REQUESTED', reason? }` as the FCM `data` payload, NOT a pre-formatted `title` + `message`.
  - The `db.notification.create` row stores the same type + reason (not the English text), so the in-app notification list can be l10n-rendered on the client.
  - `createAndSend` is updated to accept a `type` discriminator and a `data` object, and to skip the title/message parameters when a type is given.

- `flutter/lib/l10n/app_en.arb` and `flutter/lib/l10n/app_hi.arb` (2 files)
  - New keys: `kycPushTitleApproved`, `kycPushBodyApproved`, `kycPushTitleRejected`, `kycPushBodyRejected`, `kycPushTitleInfoRequired`, `kycPushBodyInfoRequired`. **Both en + hi must carry proper translations** (per the standing i18n rule). If a Hindi translation is uncertain, mark `// hi-review:` for the human translator.

- `flutter/lib/services/notification_service.dart` (1 file, the LOCAL notification service — different from the FCM one)
  - When a KYC push arrives via FCM with `data.type === 'KYC_APPROVED'`, the local notifier decodes the type and renders the ARB string. Currently the local notifier just receives the FCM message verbatim and shows it.

- `flutter/test/services/notification_service_test.dart` (update)
  - Add tests that each KYC type renders the correct ARB string in both en and hi.

### 3.3 Fix sketch (server)

```ts
// web/src/lib/notification-service.ts
async notifyKycStatusChange(
  riderId: string,
  status: 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED',
  reason?: string,
) {
  // Don't pre-format the title/message on the server. Send the
  // discriminator + structured data; the Flutter client renders
  // the localized string from its ARB bundle.
  return this.createAndSend(
    riderId,
    /* title */ '',  // empty — the client renders from the type
    /* message */ '',
    'KYC_UPDATE',
    {
      screen: 'KYC_STATUS',
      type: `KYC_${status}`,  // KYC_APPROVED | KYC_REJECTED | KYC_INFO_REQUESTED
      ...(reason ? { reason } : {}),
    },
  );
},
```

The `db.notification.create` row that `createAndSend` writes also gets the `type` discriminator instead of the English text. This requires a small migration on the `Notification` model — the `type` field is already a `NotificationType` enum (per the schema: `INFO`, `ALERT`, `PROMOTION`, etc.), but it doesn't carry the FCM discriminator. Either:
- Add a new `NotificationType` enum value `KYC_*` and store the discriminator there
- OR store the discriminator in a new `payload: String?` JSON column

Option 1 is cleaner if the enum is what's rendered. The audit has T-95 + P2-12 in the same family, so the same migration is justified.

### 3.4 Fix sketch (Flutter)

```dart
// flutter/lib/l10n/app_en.arb (additions)
"kycPushTitleApproved": "KYC Approved! ✅",
"kycPushBodyApproved": "Your documents have been verified. You can now pick up your vehicle.",
"kycPushTitleRejected": "KYC Update Required ⚠️",
"kycPushBodyRejected": "Your KYC was rejected: {reason}",
"@kycPushBodyRejected": { "description": "Body of the KYC rejection push notification. {reason} is the admin's rejection reason; falls back to a generic message if absent." },
"kycPushTitleInfoRequired": "More Information Needed",
"kycPushBodyInfoRequired": "We need a bit more information to verify your account.",

// flutter/lib/l10n/app_hi.arb (additions) — proper translations, both files
"kycPushTitleApproved": "KYC स्वीकृत! ✅",
"kycPushBodyApproved": "आपके दस्तावेज़ सत्यापित हो गए हैं। अब आप वाहन उठा सकते हैं।",
"kycPushTitleRejected": "KYC अपडेट आवश्यक ⚠️",
"kycPushBodyRejected": "आपका KYC अस्वीकृत कर दिया गया: {reason}",
"kycPushTitleInfoRequired": "अधिक जानकारी चाहिए",
"kycPushBodyInfoRequired": "आपके खाते को सत्यापित करने के लिए हमें थोड़ी और जानकारी चाहिए।",
```

```dart
// flutter/lib/services/notification_service.dart (LOCAL notification service)
// New method: render a remote KYC push into a localized notification.
void _maybeRenderKycPush(RemoteMessage message) {
  final data = message.data;
  final type = data['type'] as String?;
  if (type == null) return;
  if (type != 'KYC_APPROVED' && type != 'KYC_REJECTED' && type != 'KYC_INFO_REQUESTED') {
    return;
  }
  final l10n = AppLocalizations.of(context);
  final reason = data['reason'] as String?;
  String title, body;
  switch (type) {
    case 'KYC_APPROVED':
      title = l10n.kycPushTitleApproved;
      body = l10n.kycPushBodyApproved;
    case 'KYC_REJECTED':
      title = l10n.kycPushTitleRejected;
      body = reason != null
        ? l10n.kycPushBodyRejected(reason)
        : l10n.kycPushBodyFallback;
    case 'KYC_INFO_REQUESTED':
      title = l10n.kycPushTitleInfoRequired;
      body = l10n.kycPushBodyInfoRequired;
  }
  _notifications.show(<id>, title, body, /* details */);
}
```

### 3.5 Test plan

**Server (web):**
- 3 unit tests in `tests/unit/notification-service-kyc-l10n.test.ts` (new):
  - `notifyKycStatusChange('APPROVED')` sends `{ data: { type: 'KYC_APPROVED' } }` and an empty title/message
  - `notifyKycStatusChange('REJECTED', 'bad photo')` sends `{ data: { type: 'KYC_REJECTED', reason: 'bad photo' } }`
  - `notifyKycStatusChange('INFO_REQUESTED', 'need Aadhaar')` sends `{ data: { type: 'KYC_INFO_REQUESTED', reason: 'need Aadhaar' } }`
- 1 unit test in `tests/unit/notification-dispatch.job.test.ts` (update): the KYC_APPROVED case calls `notificationService.notifyKycStatusChange` with `'APPROVED'` (not `'APPROVED' as any`), and the returned data carries the discriminator.

**Flutter:**
- Source-grep test that the 6 new ARB keys exist in BOTH `app_en.arb` and `app_hi.arb` (the standing i18n rule).
- 3 widget tests in `test/services/notification_service_test.dart` (add): the KYC renderer in `_maybeRenderKycPush` produces the correct title/body for each type, with locale `en` and `hi`.

### 3.6 Acceptance criteria

- The 6 new ARB keys exist in BOTH `app_en.arb` AND `app_hi.arb` (no English fallbacks)
- The `kycPushBodyRejected` template's `{reason}` placeholder is honored when the server includes a `reason`
- A Hindi rider with `hi` locale sees the KYC push in Hindi (test on a real device with a fresh FCM token)
- An English rider with `en` locale sees the KYC push in English (regression check — current behavior)
- The `db.notification.create` row for KYC decisions carries the discriminator (so the in-app notification list can be l10n-rendered on the client, mirroring the push)

### 3.7 Reviewer focus notes

- **The i18n rule is non-negotiable**: both ARB files must carry proper translations, no English fallbacks. The user memory entry says: "BOTH `app_en.arb` and `app_hi.arb` must carry proper translations — no English fallbacks. If a Hindi translation is uncertain, mark `// hi-review:` for the human translator; do not ship a key with only the English value."
- The server-side `title` and `message` going to FCM are now empty strings. FCM's behavior with empty `notification.title` and `notification.body` may not render the system tray notification at all — the Flutter client must use the FCM **data** payload to render the LOCAL notification. This is the whole point of the refactor.
- The `Notification` model migration is a small but real DB change. The Prisma migration file goes in this PR too.
- The Hindi translations are placeholders pending a real translator. The PR-3 reviewer should expect `// hi-review:` markers on the new Hindi keys; reject the PR if any key has the English value only.

### 3.8 Risk

Medium. Cross-stack refactor. Behavior change: a rider who never had the localization fix sees identical copy; a rider with `hi` locale now sees the KYC push in Hindi (good). The migration on the `Notification` model is reversible. The FCM payload change is reversible. The ARB keys are additive.

### 3.9 Rollback

Revert the commit. The server falls back to pre-formatted English (current behavior). The Flutter client falls back to displaying the FCM `notification.title` and `notification.body` verbatim (which the server will start sending again post-rollback).

---

## 4. PR ordering & total effort

| PR | Tickets | Effort | Description | Risk | Dependencies |
|---|---|---|---|---|---|
| **PR-F** | logging-consistency | 0.25 d | fcm_service.dart: revert to `appDebug` (match 93-file standard) | Low | None |
| **PR-E** | T-95 + N-2 split | 0.5 d | `createAndSend` 4xx-vs-transient classification; PostHog event name split; dispatcher rethrow propagation | Medium | PR-C (already shipped) |
| **PR-G** | P2-12 KYC l10n | 1 d | Cross-stack: server sends discriminator + data; Flutter renders from ARB (en+hi); `Notification` model migration | Medium | T-91 (already shipped), T-95 (PR-E) for the rethrow path |

**Total: ~1.75 days focused, 3 PRs.**

**Why this order:**
- PR-F first: isolated, lowest risk, mechanical. Easy to approve.
- PR-E second: server-side, builds on the N-2 work shipped in PR-C. Refines the PostHog event name (anyone with insights must update filters).
- PR-G last: cross-stack, biggest blast radius, requires the T-95 rethrow path to be in place first. The refactor depends on `notifyKycStatusChange`'s caller (the dispatcher) correctly handling the new return shape, which T-95 establishes.

---

## 5. Definition of done for the whole sequence

- [ ] PR-F merged: `grep -c 'developer\.log' flutter/lib/services/fcm_service.dart` returns 0; `flutter analyze --no-pub` is clean; 17 fcm_service tests pass
- [ ] PR-E merged: `createAndSend` returns `{ success: false, permanent: true }` on 4xx; rethrows on 5xx / network; PostHog event names split into `fcm_push_dead_lettered` and `fcm_push_transient_error`; dispatcher rethrow verified
- [ ] PR-G merged: 6 new ARB keys (3 title + 3 body) in BOTH `app_en.arb` AND `app_hi.arb`; Hindi translations reviewed by human; Hindi rider on a real device sees KYC push in Hindi
- [ ] Web unit test count ≥ the count after the 4-PR polish batch (no regressions)
- [ ] Flutter unit test count ≥ 1640 (the previous 1639 + the new KYC l10n tests)
- [ ] Linter clean (`npm run lint`, `flutter analyze --no-pub`)

**After this sequence: workflows vertical is fully closed out.** The original 10-PR plan (T-90..T-99 + polish) shipped in 2026-08-23; the 4-PR polish batch shipped 2026-08-28; this 3-PR batch closes the remaining deferred items.

---

## 6. Out of scope for this doc

- The other notification types (`SUPPORT_REPLY`, `PAYMENT_DUE`, `REWARD`, `SHIFT_REMINDER`, `BIRTHDAY_WISH`) have the same English-copy issue as the KYC ones. The l10n refactor for those is the same shape as P2-12; the audit can be extended to cover them once the KYC path is proven.
- The audit note about `wallet-ledger.note` and `transaction.description` carrying rider PII (N-4 / N-5 in the previous plan's appendix) — those are real GDPR risks but are a separate audit.
- Admin-side `notifyKycStatusChange` l10n (the admin panel's KYC decision UI) — out of scope; the admin panel is already en-only and not in this batch's priorities.

---

## 7. Appendices

### 7.1 What was deferred from the 4-PR polish batch and why

| Item | Why deferred | Where it lands |
|---|---|---|
| **P2-11 (Rider.purgedAt)** | Already shipped in PR-4 / T-94 of the 2026-08-23 audit batch. Column exists, cron filter exists, audit log shape is correct. | Done (no action needed) |
| **P2-12 (KYC l10n)** | Cross-stack refactor (server + Flutter ARB + Flutter notification_service). Bigger than 0.5 day, deferred to its own PR. | PR-G (this doc) |
| **T-95 (4xx-vs-transient)** | Audit claimed shipped, code shows it's NOT shipped. Real gap, missed by the audit re-verification. | PR-E (this doc) |
| **fcm_service.dart logging** | Cosmetic regression from commit `0e25d4d6`. PR-C and PR-D preserved the drift. | PR-F (this doc) |
| **P2-12 (other notification types)** | Same shape as KYC; deferred to a future audit. | Out of scope (this doc) |

### 7.2 Why fcm_service.dart's logging was a real issue worth fixing

The `appDebug` helper has these properties (per `app_logger.dart`):
- Routes through `package:logger`'s `Logger` instance
- In debug mode (`kDebugMode`): PrettyPrinter with method count, line length, colors, emojis
- In release mode: SimplePrinter; level gated to `Level.info`+
- Consistent with the 93 other files that use it

`developer.log` from `dart:developer`:
- Routes through the Dart VM service
- Always prints to logcat (no level gating in release)
- Format: `[{ISO timestamp}] [{level}] {message}` (raw)
- Used by only 34 files in the codebase

The drift was likely introduced by `0e25d4d6` because the fcm_service.dart was being heavily modified and the author wasn't aware of the `appDebug` convention. PR-C and PR-D preserved it because the fcm_service.dart already used `developer.log` and the new helpers (`setPushMuted`, `applySecurityAction`) followed the existing pattern.

Fixing this in PR-F is a 25-line change (one import + 25 `developer.log` → `appDebug` replacements) and brings the file in line with the rest of the codebase.

### 7.3 The T-95 audit-vs-code drift

The workflows audit (`docs/AUDIT_WORKFLOWS_2026-08-23.md`) §2.4 said:
> "T-95 (PR-5, 2026-08-23): the previous code called `notificationService.notifyKycStatusChange(...)` AND `db.notification.create(...)` separately, producing TWO notification rows per KYC decision. `createAndSend` already persists the in-app row (see notification-service.ts:35-48); the explicit `db.notification.create` here is the duplicate."

The audit's claim is that the duplicate `db.notification.create` in the dispatcher was removed. That part IS true (I verified it). The audit also implied that the 4xx-vs-transient classification was added to `createAndSend` as part of the same fix. That part is **not** true.

The audit's PR list (`FOLLOWUP_TICKETS.md` "Shipped 2026-08-23" section) lists T-95 as:
> ✅ "PR-5 (T-95) — dropped redundant db.notification.create in 3 KYC cases; notificationService.createAndSend rethrows transient + tags 4xx as { permanent: true }. 6 new unit tests."

The "rethrows transient + tags 4xx as { permanent: true }" is the part that's missing from the code. The "dropped redundant db.notification.create" IS present.

This is a real audit gap. The re-verification checklist in §9.1 of the audit doc should have caught this. The PR-E fix in this plan closes the gap.

**If the audit re-verification had been more rigorous** (i.e. grep'd for `permanent: true` in the file), it would have caught this before I shipped the 4-PR polish batch. Recommendation for future audits: every finding's "what was actually fixed" claim should be backed by a grep-able marker comment in the code, not just a "claimed" claim in the doc.

### 7.4 Why PR-G (P2-12) is bigger than the 0.5 day the previous plan said

The previous plan (§3.3 Polish PR-B) said "0.5 day" for P2-12. That was a miscalculation. The actual work is:

| Step | Effort |
|---|---|
| Add 6 ARB keys (en + hi) with proper translations | 0.1 d |
| Server: `notifyKycStatusChange` sends discriminator + data, not English | 0.1 d |
| Server: `createAndSend` accepts type-discriminator path | 0.1 d |
| Server: `Notification` model migration (new column or new enum) | 0.1 d |
| Flutter: `_maybeRenderKycPush` in `notification_service.dart` | 0.2 d |
| Flutter: 3 widget tests for en + hi rendering | 0.1 d |
| Server: 3 unit tests for the discriminator | 0.1 d |
| Cross-stack coordination + code review cycles | 0.2 d |
| **Total** | **~1.0 d** |

The 0.5 d estimate was for the ARB keys only. The cross-stack refactor is the bigger lift. PR-G is now sized at 1 d.
