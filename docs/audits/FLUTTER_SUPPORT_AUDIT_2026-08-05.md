# Flutter Rider App — Support Screen & Sub-Screens — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:**
- `flutter/lib/features/support/` — 15 files (~125 KB)
  - `presentation/screens/support_center_screen.dart` (473 lines) — the entry point
  - `presentation/screens/faq_screen.dart` (429 lines) — the FAQ list
  - `presentation/screens/create_ticket_screen.dart` (304 lines) — the ticket creation form
  - `presentation/screens/ticket_detail_screen.dart` (100 lines) — read-only ticket view
  - `presentation/screens/troubleshooter_screen.dart` (587 lines) — the diagnostic decision tree
  - `presentation/screens/troubleshooter_result.dart` (read-only result widget)
  - `presentation/screens/support_checklist_screen.dart` (168 lines) — pre-ticket checklist
  - `presentation/screens/feedback_screen.dart` (510 lines — **mislabeled; contains a TutorialOverlay system, the FeedbackScreen, and a RateAppPrompt — 3 unrelated things in one file**)
  - `presentation/providers/support_provider.dart` (200 lines) — the main provider
  - `presentation/providers/ticket_provider.dart` (74 lines) — a parallel provider for tickets with divergent behavior
  - `presentation/widgets/support_widgets.dart` (478 lines — **3 of 4 widgets are dead code**: `RaiseTicketCard`, `TicketListItem`, `TopActionCard`)
  - `presentation/widgets/troubleshooter_widgets.dart` (used by troubleshooter)
  - `data/repository_impl.dart`, `domain/repository.dart`, `domain/entity.dart`
- Related: `flutter/lib/models/support_model.dart` (has 2 parallel ticket message types: `TicketMessageEntity` in domain layer + `TicketMessage` in models layer, both with different shapes)
- Related: `flutter/lib/data/troubleshooter_tree.dart` (imported by troubleshooter — static data, not in a provider)
- Tests: `flutter/integration_test/e2e_individual/20_support_screen_test.dart`, `21_support_faq_test.dart`, `22_support_chat_test.dart`, `23_support_ticket_test.dart` (all smoke tests that assert text presence; none actually exercise ticket submission, FAQ search, or troubleshooter flow)

**Out of scope:** The admin side of support tickets (covered in earlier admin audits — see ADMIN_SUPPORT_INCIDENT_FINES_AUDIT_2026-08-05.md). The SupportConfig registry on the server. KYC / onboarding / rental flows.

---

## TL;DR

**The support feature has 3 hardcoded placeholder contact details (one phone number, two email addresses) that don't match across the 3 screens that surface them.** The search bar in the support center searches a 4-item hardcoded list, **not the real FAQ data**. The create-ticket form has no photo attachment, even though a fully-built `RaiseTicketCard` widget with photo + voice support exists in the codebase but is **never used** — it was a refactor that got half-done. The ticket detail screen is read-only — riders cannot add follow-up messages. And the `feedback_screen.dart` file is actually a 510-line file containing 3 unrelated things (a `TutorialOverlay` system that's never called, a `FeedbackScreen`, and a `RateAppPrompt` that can never fire because the launch counter is only incremented during onboarding).

There are **2 parallel ticket providers** (`supportProvider` and `supportTicketsProvider`) that both fetch the same data with different code paths, different error handling, and different shapes (`IssueModel` vs `TicketEntity`). The `TicketFilter` enum has 4 statuses but `TicketStatus` has 5 — **tickets with status `resolved` show in the "All" filter but in no named filter**, making them effectively invisible to riders who filter.

`RiderNotifier.logout()` does not call `supportProvider.notifier.logout()` (same cross-audit pattern as audits #7 and the rental audit P0-4). The support center's search dropdown is wired to 4 hardcoded strings, not the API FAQ data. The `create_ticket_screen` shows a snackbar **on the wrong navigator** (after `pop()`) and then auto-pushes the troubleshooter checklist whether the rider wanted it or not.

There are **3 P0s** (search uses hardcoded list; create-ticket cannot attach photos; logout doesn't clear support state), **9 P1s** (3 placeholder contact details; 2 dead widgets; 2 parallel ticket providers; filter mismatch; test/code desync; PostHog never fired for ticket_created-from-troubleshooter; etc.), and **6 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, silent data loss, riders missing critical UI | Before next release |
| **P1** | UX friction, accessibility, race condition, misleading data, dead code | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: Support Center's search bar searches a 4-item hardcoded list — not the real FAQ data

**File:** `flutter/lib/features/support/presentation/screens/support_center_screen.dart` lines 87-108.

**What:** The `SearchAnchor` widget in the support center has a `suggestionsBuilder` that searches a hardcoded list of 4 strings:

```dart
// support_center_screen.dart:90-98
final staticFaqs = [
  'How to lock the scooter?',
  'Payment failed',
  'Report a damaged vehicle',
  'Refund policy'
];
final matches = staticFaqs
    .where((f) => f.toLowerCase().contains(keyword))
    .toList();
```

This list is **not** the FAQ data fetched from the API. The real FAQ content (from `supportProvider.faqs`) is never shown in the search. Tapping a suggestion pushes the `FaqScreen`, which has its OWN search bar and its OWN list of FAQs (the real ones), and **the search keyword the user typed is not passed through** — they have to retype it.

The hardcoded list also doesn't include the 2 hardcoded `FaqItem` seed entries in `support_provider.dart` (lines 102-117), so there's no overlap between the 2 sources.

**Repro:**
1. Log in as a rider.
2. Navigate to the support tab.
3. Type "battery" into the search bar.
4. **Observe:** no suggestions. The 4 hardcoded entries don't contain the word "battery".
5. Type "payment" instead.
6. **Observe:** one suggestion: "Payment failed". Tapping it opens the FAQ screen, which now shows ALL FAQs from the API, not the one the user clicked on, and the search keyword is empty.

**Impact:** The most discoverable entry point to support is broken. The rider who tries to self-serve by typing their issue into search gets either nothing or an unrelated jump to the FAQ list. They give up and create a ticket. Ticket volume goes up; resolution time goes up.

**Fix:** Either remove the search bar entirely (the FAQ screen has its own search) or wire it to the real FAQ data:
```dart
final faqItems = ref.watch(supportProvider.select((p) => p.faqs));
final matches = faqItems
    .where((f) => f.question.toLowerCase().contains(keyword) ||
                  f.answer.toLowerCase().contains(keyword))
    .map((f) => f.question)
    .toList();
```
And pass the keyword to the FAQ screen via the `FaqScreen` constructor (currently `const FaqScreen()` with no args).

**Effort:** 15 min. **Risk:** Low. **Cross-fix with:** P1-1 (the phone/email placeholder hardcoding).

---

### P0-2: `create_ticket_screen.dart` has no photo attachment — the fully-built `RaiseTicketCard` widget that does is dead code

**Files:**
- `flutter/lib/features/support/presentation/widgets/support_widgets.dart` lines 54-316 (`RaiseTicketCard` — 263 lines, supports up to 5 photos + voice input).
- `flutter/lib/features/support/presentation/screens/create_ticket_screen.dart` (304 lines, no photo UI).
- `flutter/lib/features/support/presentation/screens/feedback_screen.dart:191-454` (`FeedbackScreen` — also no photo UI, but it's a different flow).

**What:** The `create_ticket_screen.dart` is what the support center's "Create Ticket" button pushes (line 175-181 of support_center_screen.dart). It has a category dropdown, a subject field, a message field, and a submit button. **It has no photo attachment UI.** A rider trying to report a damaged vehicle, a flat tire, a broken mirror, a misbehaving dashboard — has to describe the issue in text only.

Meanwhile, `RaiseTicketCard` in `support_widgets.dart` is a 263-line widget that has:
- Issue type dropdown (line 140-159)
- Description field with voice-input stub (line 180-208)
- Photo grid (up to 5 photos, line 218-281)
- "Raise Ticket" submit button (line 283-313)

`RaiseTicketCard` is **never imported anywhere**. The `support_widgets.dart` barrel file has `RaiseTicketCard`, `TicketListItem`, and `TopActionCard` — all three are dead code.

The 23_support_ticket_test.dart integration test even references `app.support.ticketDescriptionField` and `app.support.raiseTicketButton` — keys that only exist in the dead `RaiseTicketCard` widget. The actual `CreateTicketScreen` has NO keys on its fields or button, so the test's `expect(descField, findsOneWidget)` would fail at runtime. The test is a **test/code desync** — the test was written for the dead widget, the live screen is a different shape.

**Repro:**
1. Log in, go to support.
2. Tap "Create Ticket".
3. **Observe:** subject, message, submit. No camera button. No way to attach a photo of a damaged vehicle.
4. To attach a photo, the rider has to exit the flow, screenshot the issue, save it to the device, then... there's no way to get it into the form.

**Impact:** A support ticket for a visual issue (the vast majority of EV support — damaged parts, error lights, dirty vehicles, broken locks) requires text-only description. The admin gets a ticket with no photos. Resolution time goes up; back-and-forth messages go up; the admin may close the ticket as "could not reproduce" because the rider's text didn't describe the issue adequately.

**Fix:** Either:
- **(a)** Make `CreateTicketScreen` use the `RaiseTicketCard` widget. ~50 lines of refactor.
- **(b)** Delete `RaiseTicketCard` and add photo attachment to `CreateTicketScreen` directly. ~80 lines.

Both fixes also need:
- Update `23_support_ticket_test.dart` to match the new screen's keys.
- Update the API call in `support_provider.dart::createTicket` to accept photos (currently only `category, subject, message` — no `attachments` parameter; the API has an `attachments` field in `TicketMessage` but `createTicket` doesn't pass it).

**Effort:** 2-3h. **Risk:** Medium (touches the create-ticket flow + tests + the API call signature).

---

### P0-3: `RiderNotifier.logout()` does not clear `supportProvider` state — multi-account device leak (cross-audit with audits #7 and rental-details P0-4)

**File:** `flutter/lib/core/state/rider_provider.dart` lines 270-277.

**What:** Same pattern as audit #7 P0-4 and the rental details audit P0-4. When rider A logs out, the `supportProvider`'s tickets list (with all of A's ticket data — subjects, messages, admin responses) persists. If rider B logs in on the same device, they could see rider A's ticket data for the brief window between the next `refreshTickets()` call.

```dart
// rider_provider.dart:270-277 (MISSING)
void logout() {
  state = const RiderState();
  _refreshInFlight = null;
  _stopDeviceDataSync();
  _hasSyncedDeviceDataOnce = false;
  stopPolling();
  DocumentLocalCache.clearAll();
  // ← MISSING: ref.read(supportProvider.notifier).logout();
  // ← MISSING: ref.read(supportTicketsProvider.notifier).reset?.call();
}
```

The `supportProvider` already has a `logout()` method (line 188-190 of support_provider.dart: `state = const SupportState();`). It just isn't called from `RiderNotifier.logout()`.

**Repro:** Same as the other audits. The leak is the support feature's tickets, FAQs, support config — anything the prior rider looked at.

**Fix:**
```dart
void logout() {
  state = const RiderState();
  _refreshInFlight = null;
  _stopDeviceDataSync();
  _hasSyncedDeviceDataOnce = false;
  stopPolling();
  DocumentLocalCache.clearAll();
  // PR-7.4: clear support + engagement state on logout so a multi-account
  // device doesn't leak the prior rider's tickets/FAQs/contact info.
  ref.read(supportProvider.notifier).logout();
  ref.read(supportTicketsProvider.notifier).reset?.call();
  ref.read(engagementProvider.notifier).logout();
}
```

**Effort:** 5 min. **Risk:** Low. **Co-fix with:** audit #7 P0-4 + rental details P0-4 (same one-liner fix, same PR).

---

## P1 — Next 2 sprints

### P1-1: Three different hardcoded contact details (phone, email) across 3 screens — riders see 3 different sets of contact info

**Files:**
- `flutter/lib/features/support/presentation/screens/support_center_screen.dart` lines 240, 251 (uses `support@voltium.in` and `+91-9876543210`).
- `flutter/lib/features/support/presentation/screens/faq_screen.dart` lines 24, 31 (uses `+919876543210` and `support@voltium.app`).
- `flutter/lib/features/support/presentation/providers/support_provider.dart` lines 64-65 (the `SupportConfig` is hardcoded with `+919876543210` and `support@voltium.app` — but the screens don't use the `SupportConfig`, they hardcode their own values).

**What:** Three sets of contact details:

| File | Phone | Email |
|---|---|---|
| `support_center_screen.dart` | `+91-9876543210` | `support@voltium.in` |
| `faq_screen.dart` | `+919876543210` | `support@voltium.app` |
| `support_provider.dart::SupportConfig` (unused) | `+919876543210` | `support@voltium.app` |

The `SupportConfig` in the provider is the canonical source — but no screen reads from it. The screens hardcode their own values. The two phone formats are subtly different (`+91-9876543210` vs `+919876543210` — hyphen vs no hyphen). The two email domains are different (`.in` vs `.app`).

**Impact:** When the company actually has a real support phone and email, they have to find and update 3 different files. If they update one, riders using the other screens see stale contact info and can't reach support. The "in vs app" domain split is a brand inconsistency.

**Fix:**
1. Pick one canonical source (the `SupportConfig` in the provider).
2. Add it to the API's `/api/support/config` endpoint (or keep the hardcoded fallback but make it the only fallback).
3. Have both screens read from `ref.watch(supportProvider).supportConfig?.supportPhone` / `.supportEmail`.
4. The 2 hardcoded values in `support_provider.dart` should be the SINGLE hardcoded fallback for both — currently the screens duplicate them with drift.

**Effort:** 30 min. **Risk:** Low. **Cross-fix with:** P0-1 (the support-center search fix touches the same screen).

---

### P1-2: `RaiseTicketCard`, `TicketListItem`, `TopActionCard` in `support_widgets.dart` are dead code (~430 lines)

**File:** `flutter/lib/features/support/presentation/widgets/support_widgets.dart` lines 54-316, 318-462, 464-478.

**What:** `grep` for each widget's name across the codebase:
- `RaiseTicketCard` — only hits in the widget file itself.
- `TicketListItem` — only hits in the widget file itself.
- `TopActionCard` — only hits in the widget file itself.

`RaiseTicketCard` is a fully-featured ticket-creation card with photo grid + voice input. `TicketListItem` is a list-item widget for tickets. `TopActionCard` is some action card widget. All three are dead.

**Fix:** Either wire them in (P0-2 is one of these — `RaiseTicketCard` is what `create_ticket_screen` should be using) or delete them. If wiring, also update the test keys. If deleting, ~430 lines deleted net.

**Effort:** 1h to wire `RaiseTicketCard` into `CreateTicketScreen` (also fixes P0-2), 5 min to delete the others. **Risk:** Low.

---

### P1-3: `TicketFilter` enum has 4 statuses but `TicketStatus` has 5 — `resolved` tickets are invisible under any named filter

**Files:**
- `flutter/lib/features/support/domain/entity.dart` line 2 (status enum: `open, assigned, inProgress, resolved, closed`).
- `flutter/lib/features/support/presentation/providers/ticket_provider.dart` line 7 (filter enum: `all, open, assigned, inProgress, closed`).
- `flutter/lib/features/support/presentation/providers/ticket_provider.dart` lines 20-26 (`filteredTickets` getter).

**What:** A ticket can be in any of 5 statuses. The filter chips in the support center only show 5 chips (`TicketFilter.values` = `all, open, assigned, inProgress, closed`). **No "resolved" filter.** A `resolved` ticket:
- Shows under "All" ✓
- Does NOT show under "Open" ✗
- Does NOT show under "Assigned" ✗
- Does NOT show under "In Progress" ✗
- Does NOT show under "Closed" ✗

The only way a rider with a `resolved` ticket sees it is if they have the "All" filter selected. After filtering, they can't find it.

**Repro:**
1. As an admin (web), mark a rider's ticket as `RESOLVED`.
2. As the rider, open the support center.
3. The ticket shows in the "Recent Tickets" list.
4. Tap the "Closed" filter chip.
5. **Observe:** the resolved ticket is gone (it has status `resolved`, not `closed`).

**Impact:** A rider with a resolved ticket cannot find it after filtering. They might resubmit a duplicate ticket. The admin sees the duplicate. Confusion.

**Fix:** Add `resolved` to `TicketFilter`:
```dart
enum TicketFilter { all, open, assigned, inProgress, resolved, closed }
```
Or change the matching logic in `filteredTickets` to treat `resolved` as part of the "closed" filter (since semantically, resolved is a flavor of closed).

**Effort:** 5 min. **Risk:** Low.

---

### P1-4: Two parallel ticket providers (`supportProvider` and `supportTicketsProvider`) both fetch tickets with different code paths

**Files:**
- `flutter/lib/features/support/presentation/providers/support_provider.dart` lines 145-166 (`SupportNotifier.refreshTickets`).
- `flutter/lib/features/support/presentation/providers/ticket_provider.dart` lines 48-65 (`SupportTicketsNotifier.fetchTickets`).

**What:** Two providers, two different models (`IssueModel` vs `TicketEntity`), two different error handling strategies, two different sources:

| | `SupportProvider.tickets` | `SupportTicketsProvider.tickets` |
|---|---|---|
| Model | `IssueModel` (from `models/support_model.dart`) | `TicketEntity` (from `features/support/domain/entity.dart`) |
| Repository | Injected via `supportRepositoryProvider` | Hardcoded `SupportRepositoryImpl(VoltiumApiClient(ApiClient()))` |
| Loading flag | `isRefreshingTickets` | `isLoading` |
| Error handling | `appDebug` log only | `appDebug` log + state.set loading=false (still no user feedback) |
| Filter support | None | `TicketFilter` enum + `filteredTickets` getter |
| `init` from router | Yes (`initSupportData` in router.dart:127) | No (provider is `Notifier`, initialized lazily on first watch) |
| Used by | `support_center_screen.dart` indirectly (the "Recent Tickets" container reads from `supportTicketsProvider`, not from `supportProvider.tickets`!) | `support_center_screen.dart::RecentTicketsContainer` |

**The kicker:** `supportProvider.tickets` (the "official" provider initialized at app start) is **never read by any screen**. The support center's "Recent Tickets" container reads from `supportTicketsProvider`. So `supportProvider.tickets` is also dead data.

This is the same "domain-driven theater" pattern as the rental audit P2-1 — two parallel data sources, neither is authoritative, the screen uses the one that was added later.

**Fix:** Pick one. Either:
- **(a)** Delete `supportProvider.tickets` and migrate `RecentTicketsContainer` to read from `supportTicketsProvider` (currently does, but `supportProvider` still fetches tickets it doesn't need → remove the parallel `refreshTickets` call).
- **(b)** Delete `supportTicketsProvider` and migrate `RecentTicketsContainer` to read from `supportProvider.tickets` (would need to add filter support to `supportProvider`).

The cleanest fix is (b) — make `supportProvider` the single source of truth, add filter support to it, delete `supportTicketsProvider` (~74 lines). Aligns the architecture.

**Effort:** 1-2h. **Risk:** Medium (touches the support center, which is the main entry point).

---

### P1-5: `create_ticket_screen.dart` shows a snackbar on the wrong navigator (after `pop()`) and auto-pushes the troubleshooter checklist whether the rider wanted it or not

**File:** `flutter/lib/features/support/presentation/screens/create_ticket_screen.dart` lines 56-71.

**What:** After `_submitTicket` succeeds, the screen does:
```dart
// create_ticket_screen.dart:55-71
if (mounted) {
  final nav = Navigator.of(context);
  nav.pop();
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('Ticket created successfully'), ...),
  );
  WidgetsBinding.instance.addPostFrameCallback((_) {
    nav.push(MaterialPageRoute(
      builder: (_) => const SupportChecklistScreen(),
    ));
  });
}
```

**Two issues:**
1. **`ScaffoldMessenger.of(context)` after `nav.pop()`** — the `context` variable still refers to this screen's BuildContext, but the screen has been popped. `ScaffoldMessenger.of(context)` walks up the widget tree from this (now-being-disposed) screen, which is in a transitioning state. The snackbar may not show, may show on a different Scaffold, or may throw "Looking up a deactivated widget's ancestor is unsafe". Best practice is to capture the ScaffoldMessenger BEFORE the pop.
2. **Auto-push the checklist** — after the ticket is created, the screen pops AND then pushes a `SupportChecklistScreen`. The rider wanted to go back to the support center (where the new ticket is now visible in the "Recent Tickets" list). Instead they're dumped into a checklist with 4 hardcoded items to check, which then pushes them to the troubleshooter. The rider wanted a ticket, not a diagnostic flow.

**Repro:**
1. Create a ticket from the support center.
2. Submit.
3. **Observe:** you're taken to a "Support Checklist" screen, not back to the support center. The "Proceed to Support" button takes you to the Troubleshooter, not back to the support flow. The only way back to the support center is the system back gesture.

**Fix:**
```dart
if (mounted) {
  final messenger = ScaffoldMessenger.of(context);  // capture before pop
  Navigator.of(context).pop();
  messenger.showSnackBar(
    const SnackBar(content: Text('Ticket created successfully'), ...),
  );
  // REMOVED: the auto-push to SupportChecklistScreen
}
```

The auto-push should be deleted entirely. If the user wants the troubleshooter, they can tap the "Troubleshoot" quick chip from the support center.

**Effort:** 5 min. **Risk:** Low.

---

### P1-6: `TicketDetailScreen` is read-only — riders cannot add follow-up messages

**File:** `flutter/lib/features/support/presentation/screens/ticket_detail_screen.dart`.

**What:** The screen shows the original complaint and a list of messages between rider and admin, but provides no input for the rider to add a new message. The `TicketMessageEntity` model has `senderType: 'RIDER'` and the API likely supports adding messages (the `getSupportChat` and `sendChatMessage` methods exist in `SupportRepository`). The 22_support_chat_test.dart asserts that a chat input is visible, but the actual `TicketDetailScreen` has no input.

A rider who has a follow-up question, or who wants to provide a photo of the issue resolution, or who has new information to add — cannot. They have to create a new ticket.

**Repro:**
1. Open a ticket detail.
2. **Observe:** the screen shows the timeline, an "Add Message" field is missing, no input is available.

**Fix:** Add a `TextField` + "Send" button at the bottom that calls `supportProvider.sendChatMessage(message, ticketId)`. ~30 lines.

**Effort:** 1h. **Risk:** Low.

---

### P1-7: `feedback_screen.dart` is mislabeled and contains 3 unrelated things — 2 of which are dead

**File:** `flutter/lib/features/support/presentation/screens/feedback_screen.dart` (510 lines).

**What:** The file contains:
- **Lines 1-175: `TutorialTip`, `TutorialOverlay`, `TutorialDialog`** — a tutorial / coach-mark dialog system. NEVER imported anywhere except in the file's own class definitions. Completely dead.
- **Lines 177-454: `FeedbackScreen`** — the actual feedback form. Used by `top_up_flow.dart:128` and `settings_screen.dart:184`.
- **Lines 456-510: `RateAppPrompt`** — a "Enjoying Voltium?" dialog. NEVER imported anywhere.

So 175 lines of dead `TutorialOverlay` code and 55 lines of dead `RateAppPrompt` code live in this file, alongside the working `FeedbackScreen`.

**The `RateAppPrompt` is also semantically broken** — it reads `prefs.getInt('launch_count')` and shows the rate dialog if `>= 10 && !hasRated`. But the launch counter is only incremented by `OnboardingService.incrementLaunchCount()`, which is called from within the onboarding flow. After onboarding (1 launch), the counter stops incrementing (no `incrementLaunchCount` call in `main.dart` or the router). The rate dialog will never show for a typical user.

**Repro:**
1. Log in, complete onboarding.
2. Use the app for 100 sessions.
3. The rate dialog never shows because `launch_count` is stuck at 1.

**Fix:**
1. **Move `TutorialOverlay` to `flutter/lib/widgets/tutorial_overlay.dart` or `flutter/lib/utils/tutorial_overlay.dart`** — it's a generic coach-mark system, not a support feature. ~175 lines relocated.
2. **Move `RateAppPrompt` to `flutter/lib/widgets/rate_app_prompt.dart`** — same reasoning. Then wire it to actually fire (e.g., on the 5th successful ride, or on the 10th day after onboarding).
3. **Keep `FeedbackScreen` where it is** (or move to its own file with the rename: `feedback_screen.dart` → keep as is, but it's the only thing in the file).

**Effort:** 1h to extract, 30 min to wire `RateAppPrompt` properly. **Risk:** Low.

---

### P1-8: Test/code desync — `23_support_ticket_test.dart` references keys that don't exist in the live `CreateTicketScreen`

**Files:**
- `flutter/lib/integration_test/pages/support_page.dart` (the page object).
- `flutter/lib/integration_test/e2e_individual/23_support_ticket_test.dart` (the test).

**What:** The test page object defines:
```dart
Finder get faqTile => find.byKey(const Key('faqTile'));
Finder get raiseTicketTile => find.byKey(const Key('raiseTicketTile'));
Finder get raiseTicketButton => find.byKey(const Key('raiseTicketButton'));
Finder get ticketDescriptionField => find.byKey(const Key('ticketDescriptionField'));
Finder get submitTicketButton => find.byKey(const Key('submitTicketButton'));
```

`grep` for these keys:
- `supportTab` — exists in the dashboard's bottom nav.
- `raiseTicketButton` — exists in `RaiseTicketCard` (dead widget) at `support_widgets.dart:284`.
- `ticketDescriptionField` — exists in `RaiseTicketCard` at `support_widgets.dart:181`.
- `faqTile`, `raiseTicketTile`, `submitTicketButton` — **never defined anywhere**.

The live `CreateTicketScreen` (which is what the support center's "Create Ticket" button pushes) has NO `Key('...')` on its fields or button — it relies on the default `find.byType(ElevatedButton)`. So `expect(descField, findsOneWidget)` in the test would fail at runtime against the live screen.

**Impact:** The integration test is dead-on-arrival against the live code. CI may be passing only because the test errors are swallowed, or because the test was written for an older version of the screen and never updated.

**Fix:** Update the test to use the new screen's widget types (e.g., `find.byType(TextFormField).first` for the description), or fix the screen to add proper keys. Either is fine; doing both is best.

**Effort:** 30 min. **Risk:** Low. **Co-fix with:** P0-2 (the photo attachment fix touches the same screen).

---

### P1-9: `troubleshooter_screen.dart` hardcodes `category: 'TROUBLESHOOTER'` — may not be a valid backend category

**File:** `flutter/lib/features/support/presentation/screens/troubleshooter_screen.dart` line 267.

**What:** When the troubleshooter creates a support ticket, it passes `category: 'TROUBLESHOOTER'`. The `create_ticket_screen` form has 4 hardcoded categories: `TECHNICAL, PAYMENT, VEHICLE, GENERAL`. The API may not accept `'TROUBLESHOOTER'` — it depends on the server-side enum. If the API rejects it, the ticket fails to create and the rider sees "Failed to create ticket" (with the raw exception stripped of `Exception:` prefix, line 285).

**Repro:** Look at the create ticket from the troubleshooter result. The category string in the API call is `'TROUBLESHOOTER'`. Compare to the form's 4 categories. Check the server-side enum (the `IssueModel` line 116 defaults to `'GENERAL'` if the server doesn't return a `category` field, suggesting the enum is bounded).

**Fix:** Map the troubleshooter category to one of the 4 valid categories (`TECHNICAL` for most issues), or add `TROUBLESHOOTER` to the form's category list and the server's enum. ~10 lines.

**Effort:** 10 min. **Risk:** Low.

---

## P2 — Cleanup backlog

### P2-1: `troubleshooter_tree.dart` is a static data file imported directly, not a Riverpod provider

`troubleshooter_screen.dart` imports `package:voltium_rider/data/troubleshooter_tree.dart` (line 5). The tree cannot be refreshed from the server, A/B tested, or per-locale customized. The data is in `lib/data/` rather than `lib/features/support/data/`, breaking the feature directory convention. Worth refactoring to a `TroubleshooterTreeProvider` that the screen reads from, so the tree can be cached and refreshed.

**Effort:** 1-2h. **Risk:** Low.

### P2-2: `feedback_screen.dart::_FeedbackScreenState` has its own `_getMonth` inline (line 11-27) instead of using `DateHelpers.months`

The `support_widgets.dart` file ALSO has a private `_getMonth` (line 11-27). Two identical copies of the same 17-line month-name list. `DateHelpers.months` already exists in `flutter/lib/utils/date_helpers.dart` (line 5-18). Replace both copies with `DateHelpers.months[month - 1]`. ~30 lines deleted.

**Effort:** 5 min. **Risk:** Low.

### P2-3: `support_checklist_screen.dart` button is enabled when checklist is empty

`_allChecked` is `_checkedItems.every((item) => item)`. On an empty list, `every` returns `true`. So when the support config hasn't loaded yet (the brief window between `initState` and `_fetchAll` completing), the user can tap "Proceed to Support" and go straight to the troubleshooter without verifying anything. Add an explicit check: `bool get _allChecked => checklist.isNotEmpty && _checkedItems.every((item) => item);` and add an empty-state UI for when `checklist.isEmpty`.

**Effort:** 10 min. **Risk:** Low.

### P2-4: `support_provider.dart::refreshFaqs` and `refreshTickets` swallow all errors with only `appDebug` logging

The user never sees the error. A failed FAQ refresh leaves the seed (2 hardcoded entries) visible; a failed tickets refresh leaves the list empty. The user thinks the support center is broken when actually it's a transient network error. Surface the error in state: `state.copyWith(lastError: '...')` and have the screen show a snackbar on error.

**Effort:** 30 min. **Risk:** Low.

### P2-5: `support_provider.dart` hardcodes 3 FAQ categories + 2 FAQ items in `initSupportData`, then overwrites with API fetch

If the API returns 0 FAQs (empty array, valid response), the 2 hardcoded items persist because `refreshFaqs` does `state.copyWith(faqs: faqsList.map(...).toList())` — passing an empty list to `copyWith` overwrites the seed. But if the API call **fails** (network error, 500), the catch on line 140 silently keeps the seed. The user sees 2 fake FAQs as if they were real. Either:
- Delete the hardcoded seed entirely (let the screen handle "0 FAQs" with an empty state).
- Wrap the seed in a `// FALLBACK:` comment + add an `isFromSeed` flag and a banner "These are example FAQs — refresh to see the latest."

**Effort:** 5 min to delete, 15 min to add the banner. **Risk:** Low.

### P2-6: `support_widgets.dart` is 478 lines with 4 widgets — only one is used (`pickSupportPhoto` function is used, but `RaiseTicketCard`/`TicketListItem`/`TopActionCard` are dead)

After fixing P1-2, the file should be 50-80 lines. The 3 dead widgets are ~430 lines. Either wire them in or delete.

**Effort:** 5 min to delete (if not using them). **Risk:** Low.

---

## Recommended fix order

| # | Item | Section | Effort | Risk |
|---|---|---|---|---|
| 1 | **P1-1** Unify phone/email/contact across 3 screens via `SupportConfig` | support_center + faq + provider | 30min | Low |
| 2 | **P0-1** Wire support center search to real FAQ data | support_center_screen | 15min | Low |
| 3 | **P0-3** Add `supportProvider.logout()` to `RiderNotifier.logout()` | rider_provider | 5min | Low |
| 4 | **P1-5** Remove auto-push to checklist + fix snackbar-after-pop | create_ticket_screen | 5min | Low |
| 5 | **P1-3** Add `resolved` to `TicketFilter` | ticket_provider | 5min | Low |
| 6 | **P1-9** Map troubleshooter category to a valid enum | troubleshooter_screen | 10min | Low |
| 7 | **P1-2 + P0-2** Wire `RaiseTicketCard` into `CreateTicketScreen` (photo + voice) | create_ticket_screen + support_widgets | 2-3h | Medium |
| 8 | **P1-8** Update `23_support_ticket_test.dart` to match new keys | tests/ | 30min | Low |
| 9 | **P1-7** Extract `TutorialOverlay` + `RateAppPrompt` from `feedback_screen.dart` | feature dir | 1h | Low |
| 10 | **P1-4** Consolidate 2 parallel ticket providers | support + ticket providers | 1-2h | Medium |
| 11 | **P1-6** Add follow-up message UI to `TicketDetailScreen` | ticket_detail_screen | 1h | Low |
| 12 | **P2-1, P2-2, P2-3, P2-4, P2-5, P2-6** Cleanup | various | 1-2h | Low |

**Suggested PR shape (each shippable independently):**
- **PR: "P0-3 + P1-1 — logout + unify contact details"** — 30 lines, 3 files. Quick win.
- **PR: "P0-1 + P1-3 + P1-9 + P1-5 — search + filter + category + auto-push"** — small fix-one-thing PRs in 1 reviewable PR. ~50 lines, 4 files.
- **PR: "P0-2 + P1-2 + P1-8 — photo attachment + dead widget cleanup + test update"** — the architectural fix for ticket creation. 2-3h, 5 files. Higher risk.
- **PR: "P1-7 — extract TutorialOverlay + RateAppPrompt from feedback_screen.dart"** — pure refactor, 1 file, 1h.
- **PR: "P1-4 + P1-6 — consolidate providers + ticket reply"** — medium effort, 4-5 files.

---

## Tests gap analysis

| Section | Existing test | What's missing |
|---|---|---|
| **Support center** | `20_support_screen_test.dart` (asserts "Support" or "FAQ" text is visible) | The P0-1 search (would catch the hardcoded FAQ list). The P1-1 contact info consistency. The P1-5 auto-push to checklist. The 3 contact buttons (TL, email, call). |
| **FAQ screen** | `21_support_faq_test.dart` (smoke test) | The search field (real FAQ search). The category filter chips. The expand/collapse behavior. The P1-1 contact buttons. |
| **Support chat** | `22_support_chat_test.dart` (asserts a TextField is visible somewhere on the page) | The P1-6 missing follow-up message input on the ticket detail. The send-chat flow. |
| **Ticket creation** | `23_support_ticket_test.dart` (asserts `findsOneWidget` on dead-widget keys) | The P0-2 missing photo attachment. The P1-5 wrong-navigator snackbar. The P1-9 invalid category. The P1-8 test/code desync (this test fails against the live screen). |
| **Troubleshooter** | None | The decision tree (pick category → answer questions → see result). The "create ticket from result" path. The SOS button. |
| **Support checklist** | None | The 4-item checklist. The "Proceed" button gating. The P2-3 empty-list edge case. |
| **Provider logic** | None | The P1-3 `resolved` filter. The P1-4 parallel providers. The P2-4 error surfacing. The P2-5 seed-vs-API race. |

**All 4 support integration tests are smoke tests that assert `findsOneWidget` on either text or widget types** — they verify that the screen renders, not that any of the support feature's actual functionality works. None of them would catch the P0s or P1s above.

The most valuable tests to add (in priority order):
1. **P0-1 test:** type "battery" in the support search → assert no results OR assert a real FAQ contains "battery" in its question/answer.
2. **P0-2 test:** open create-ticket → assert a photo attachment button is present.
3. **P0-3 test:** log out → log in as a different rider → assert no tickets from the prior rider are visible.
4. **P1-1 test:** contact info on the 3 screens matches the SupportConfig.
5. **P1-3 test:** filter tickets by "closed" → assert resolved tickets are either included or have their own filter.
6. **P1-6 test:** open ticket detail → assert a follow-up message input is present.
7. **P1-8 test:** run the existing `23_support_ticket_test.dart` against the live code → it should fail. Fix the test or the code.

---

## Architecture observations (informational)

1. **The support feature is reachable via 4 different entry points** that bypass the AuthState state machine (same as the rental details audit P0-2): the support tab in the bottom nav, the workflow hub, the FAQ screen via the search anchor, and the "Contact Support" tile. None of them are routed through the router. A wholesale "every pushed screen is an AuthState" refactor would also fix this for support.

2. **The router initializes the support provider at app start** (`router.dart:127`: `ref.read(supportProvider.notifier).initSupportData();`) but the router does NOT initialize `supportTicketsProvider`. The latter is initialized lazily on first watch (via `Future.microtask` inside `build()`). This means a rider who lands on the dashboard, doesn't visit the support tab, and then taps a notification that opens a ticket detail will have an uninitialized support provider. Adding `ref.read(supportTicketsProvider)` to the router's `initState` would fix this.

3. **The `IssueModel` (in `models/support_model.dart`) and `TicketEntity` (in `features/support/domain/entity.dart`) are two parallel models for the same thing** — a support ticket. `IssueModel` has 7 fields; `TicketEntity` has 10 (more). `IssueModel.fromJson` accepts `ticketId ?? id`; `TicketEntity.fromJson` requires `id` (would crash if only `ticketId` is returned). The two models exist because the data layer was refactored from `models/` to `features/support/domain/` but not all callers migrated. The cleanest fix is to delete `IssueModel` and have all callers use `TicketEntity`.

4. **The `SupportConfig` model is wired to the data layer but the screens don't read it.** The provider seeds it with hardcoded values, the API can return a real one (per the model), but `support_center_screen.dart` and `faq_screen.dart` both hardcode their own phone/email. The canonical `SupportConfig` is a single source of truth that nobody uses.

5. **The `RaiseTicketCard` widget was clearly built first, then someone wrote `create_ticket_screen.dart` from scratch with a simpler form that doesn't include the photo/voice UI.** The dead widget is a time capsule of the original design. The current `create_ticket_screen.dart` is the "minimum viable" replacement. The fact that the integration test `23_support_ticket_test.dart` references the dead widget's keys suggests the test was written for the original design and never updated.

6. **`feedback_screen.dart` is the most egregious case of "feature directory violation" in the codebase.** It contains 3 unrelated things (a tutorial system, a feedback form, a rate-the-app prompt), one of which is the actual feature and 2 of which are dead. This file should be split into 3 files, and the dead code should be deleted (the tutorial system) or wired up properly (the rate prompt).

7. **The `AppGradients.primary` import in `troubleshooter_screen.dart:339` is the only place in the support feature that uses a gradient app bar** — every other support screen has a solid-color app bar. The visual inconsistency is jarring: a rider who navigates from the FAQ screen (solid blue-grey app bar) to the troubleshooter (gradient blue app bar) sees a jarring color change. The brand book is in flux.

8. **The `troubleshooter_tree.dart` is a static data file** in `lib/data/` — the only such file outside `lib/features/<feature>/data/`. It's imported directly by the screen (line 5 of troubleshooter_screen.dart), not via a Riverpod provider. A test for the tree's structure would have to mock the file system. Moving the tree to a provider and making it a proper data source is the right cleanup.

9. **`RiderProvider` and `SupportProvider` both have `logout()` methods** (in different forms), but `RiderProvider.logout()` only calls its own internal cleanup. The pattern of "every NotifierProvider needs a `logout()` method" is a sign that the architecture wants a `MultiProvider` or a `Listener` that resets all providers on logout. The current "manually call each one" is fragile (any new provider that has user-scoped state must remember to add a call here). A small refactor: have each provider subscribe to a `SessionProvider` and reset on session change. ~30 min of work.

---

## Out-of-scope notes

- **The admin side of support tickets** is covered in `ADMIN_SUPPORT_INCIDENT_FINES_AUDIT_2026-08-05.md`. The rider-side `TicketDetailScreen` cannot add a message (P1-6), but the admin panel can — so the conversation is one-way from the rider's perspective after the initial submission.
- **The support chat endpoint exists** (`/api/support/chat`) and `getSupportChat` / `sendChatMessage` methods are in the repository, but no rider-side screen actually uses them. The `22_support_chat_test.dart` asserts that a `TextField` is visible *somewhere* on the support center page — but the support center doesn't have a chat input. The test passes by finding any TextField (e.g., the FAQ search bar in the support center has one). A real chat UI is unimplemented.
- **The `IssueModel` -> `TicketEntity` migration is a partial refactor.** The "support center" reads `supportTicketsProvider` (which uses `TicketEntity`), but the "troubleshooter" uses `supportProvider` (which uses `IssueModel` for the tickets list, though it never actually reads the tickets list — it calls `createTicket` and that's it). A wholesale migration to `TicketEntity` would clean up the model layer.
- **The `RiderLifecycleGate` doesn't include any "support suspended" state.** If the admin suspends the rider's account for support-related reasons (e.g., abuse of the ticket system), there's no rider-side handling. The dashboard's lifecycle gate would route them to `accountClosed`, but a `supportSuspended` state would let the rider still see their existing tickets (so they can read admin's response before the suspension takes effect).
- **The "Auto-attach device state" feature** is mentioned in the support widget's `description` field placeholder but not implemented. A future improvement would auto-attach the rider's last known device state (battery, app version, network type) to the ticket description, so the admin can diagnose without asking.
- **The troubleshooter decision tree is in English only** — no i18n. A Hindi-speaking rider sees the English tree, which is the same as the rest of the app. The `l10n/` directory exists with a localization system; the troubleshooter tree should be migrated to it.
- **The ticket detail screen's app bar title is the raw `ticketId` (e.g., "TKT-2024-001")** — not a user-friendly title. A rider who has 5 open tickets can't tell which one is which from the app bar alone. The `subject` should be the app bar title (or both, with the subject as a primary line and the ID as a secondary line).
