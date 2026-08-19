# Flutter Rider App — Emergency Screen & Sub-Screens — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** the entire emergency surface in the rider app:
- `flutter/lib/features/device_compliance/presentation/screens/emergency_sos_screen.dart` (227 lines — the SOS long-press button)
- `flutter/lib/features/device_compliance/presentation/screens/emergency_contacts_screen.dart` (415 lines — the contacts list + add/edit/delete UI)
- `flutter/lib/services/emergency_contacts_service.dart` (196 lines — the Riverpod v3 `EmergencyContactsNotifier` with `_hydrate` from SharedPreferences)
- `flutter/lib/features/profile/presentation/widgets/profile_widgets.dart` lines 365-414 (`ProfileEmergencySosTile` — the entry-point tile on the profile screen)
- `flutter/lib/features/workflows/presentation/screens/rider_workflow_hub_screen.dart` lines 218-230 (the "Emergency SOS" + "Emergency contacts" workflow tiles)
- `flutter/lib/features/support/presentation/screens/troubleshooter_screen.dart` lines 214-247 (the `_triggerSOS` method that pops a dialog calling `tel:112` when a troubleshooter result is `DANGER`)
- Related: `flutter/lib/models/rider_model.dart` lines 147, 244, 340, 408, 607, 671, 708 (`rider.emergencyContact` — a single string field on the rider model, separate from the multi-contact `EmergencyContact` list in the service)
- Tests: **none** — `grep` for `emergency` / `sos` in `integration_test/e2e_individual/` returns 0 hits. The emergency feature has **zero integration test coverage**

**Out of scope:** The web's emergency features (no rider-side analog). The admin's emergency contact management (the web admin probably doesn't have it). The device-policy provider (`features/device_compliance/presentation/providers/device_policy_provider.dart`) — it's about device admin / battery / permissions, not emergency.

---

## TL;DR

**The emergency feature is the highest-stakes surface in the rider app and the most under-built.** A rider who long-presses the giant red SOS button sees a snackbar saying "SOS Alert Triggered! Help is on the way." — but **no SOS is actually triggered, no number is dialed, no location is shared, no contacts are notified, and no alert is sent to the admin or team leader**. The button is a no-op. The user thinks they've called for help; they haven't.

The two emergency screens (SOS + Contacts) are **disconnected from each other**:
- `EmergencySOSScreen` reads `rider?.emergencyContact` (a single string field from the rider's profile) and **ignores the `EmergencyContactsNotifier` entirely** (which manages up to 5 contacts).
- A rider who has set up emergency contacts via the contacts screen still sees only their single `rider.emergencyContact` on the SOS screen.
- Adding contacts doesn't affect the SOS screen at all.

Plus: **zero integration tests** for the entire emergency feature. This is the highest-stakes surface in the app, and CI has never asserted that any part of it works.

There are **5 P0s** (SOS button is a no-op; hardcoded `+91-9876543210` placeholder for Voltium Support; SOS doesn't share location; SOS doesn't notify emergency contacts; zero test coverage), **5 P1s** (EmergencyContactsNotifier `_hydrate` race condition; `EmergencyContact.id` collision; SOS is long-press only with no confirm; Police/Ambulance hardcoded for India; etc.), and **4 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, safety risk, silent data loss, riders stranded | Before next release |
| **P1** | UX friction, race condition, accessibility, misleading data | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: The SOS long-press button is a no-op — it shows a snackbar but does NOT call any number, notify any contact, share location, or alert Voltium staff

**File:** `flutter/lib/features/device_compliance/presentation/screens/emergency_sos_screen.dart` lines 72-108.

**What:** The 200×200 red "SOS" circle is the centerpiece of the emergency screen. The user is supposed to long-press it. The handler is:
```dart
// emergency_sos_screen.dart:72-81
GestureDetector(
  onLongPress: () {
    PostHogService.capture('emergency_sos_triggered');
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('SOS Alert Triggered! Help is on the way.'),
        backgroundColor: AppColors.error,
      ),
    );
  },
  ...
)
```

Two things happen:
1. `PostHogService.capture('emergency_sos_triggered')` — an analytics event. Useful for measurement but doesn't help the rider.
2. A snackbar saying "Help is on the way." — which is **a lie**. No help has been notified.

**No number is dialed.** No `tel:` URI is launched. No SMS is sent. No API call is made to the backend. No FCM notification is sent. No location is shared. The rider is in an emergency and the app just shows them a toast.

Compare to the same screen's Police/Ambulance/Voltium Support contact cards (lines 129-160), which DO call numbers via `_callNumber(...)` (line 14-20). The SOS button is **less functional than the contact cards** — at least the contact cards actually launch the dialer.

**Repro:**
1. Log in as a rider, navigate to Profile → Emergency SOS (or Workflow Hub → Emergency SOS).
2. Long-press the big red "SOS" button for 1 second.
3. **Observe:** a snackbar appears saying "Help is on the way." The dialer doesn't open. No number is called. The rider can continue using the app.
4. There is no record anywhere that an SOS was triggered. The PostHog event is the only trace.

**Impact:** This is a safety issue. A rider who is in an actual emergency and long-presses the SOS button expects help to be on the way. They are misled. They might stop trying to call for help themselves ("the app is handling it"). They are stranded.

**Fix:** At minimum, the SOS button should:
1. Launch the phone dialer to `112` (India's emergency number) — or to a configured regional number.
2. Send an alert to the backend (POST `/api/emergency/sos`) with the rider's location, time, and emergency contact IDs.
3. Notify the rider's emergency contacts via SMS / push notification.
4. Show a follow-up "calling now..." UI with a cancel option.

**Effort:** 1-2 days (touches the API, FCM, contacts notification, dialer integration). **Risk:** High (this is a safety feature; the fix must be well-tested).

---

### P0-2: `EmergencySOSScreen` shows a hardcoded "Voltium Support" number `+91-9876543210` — the same placeholder from the support screens

**File:** `flutter/lib/features/device_compliance/presentation/screens/emergency_sos_screen.dart` line 156, 159.

**What:** The "Voltium Support" card on the emergency screen shows:
```dart
// emergency_sos_screen.dart:153-160
_buildEmergencyContactCard(
  icon: Icons.support_agent,
  title: 'Voltium Support',
  number: '+91-9876543210',   // ← hardcoded placeholder
  color: AppColors.primary,
  isFullWidth: true,
  onTap: () => _callNumber('9876543210'),  // ← sanitized to '9876543210'
),
```

This is the SAME placeholder phone number from the support screens (support audit P1-1: `support@voltium.in` vs `support@voltium.app` + `+91-9876543210` vs `+919876543210`). It's a **fake number that no one answers**.

**Worse on the SOS screen than on the support screen:** on support, a rider might tolerate a wrong number and try email instead. On the emergency screen, the rider may rely on the Voltium Support number to coordinate help — calling `9876543210` from a real emergency would waste precious time.

**Repro:**
1. Open the emergency SOS screen.
2. Tap "Voltium Support".
3. **Observe:** the phone dialer opens with `9876543210`. A real rider in an emergency calling this number would get a "number not in service" or "subscriber not reachable" response.

**Fix:** Pull the real support number from the same `SupportConfig` provider suggested in the support audit P1-1. The `EmergencySOSScreen` should read `ref.watch(supportProvider).supportConfig?.supportPhone` (or whatever the field is called). If the config isn't loaded, fall back to the rider's team leader's phone (from `rider?.emergencyContact` or `rider?.teamLeader`).

**Effort:** 30 min. **Risk:** Low. **Co-fix with:** support audit P1-1.

---

### P0-3: The SOS screen ignores the `EmergencyContactsNotifier` and only reads `rider?.emergencyContact` — a single string field that the user can't edit

**Files:**
- `flutter/lib/features/device_compliance/presentation/screens/emergency_sos_screen.dart` lines 24-25, 116-128.
- `flutter/lib/services/emergency_contacts_service.dart` (the multi-contact manager).

**What:** The two emergency surfaces are **completely disconnected**:

1. `EmergencyContactsScreen` lets the rider add up to 5 contacts via the `EmergencyContactsNotifier` (SharedPreferences-backed). It has `addContact`, `updateContact`, `removeContact`, `setPrimaryContact`, `clearAll`. The state lives in the provider.

2. `EmergencySOSScreen` reads only `rider?.emergencyContact` (a single string field on the rider model, populated by the backend). It renders a single "My Emergency Contact" card if that field is non-null.

**The rider's experience:**
- They go to the contacts screen, add 3 emergency contacts (mom, dad, sister).
- They go to the SOS screen.
- They see a single "My Emergency Contact" card (or nothing, if the rider model doesn't have `emergencyContact`).
- The 3 contacts they just added are **nowhere on this screen**.
- Tapping the single card dials the one number from the rider model — NOT the 3 contacts they added.

**Why this matters for safety:** the contacts screen is the place where the rider curates their safety net. The SOS screen is the place where they USE that safety net. The two are the same feature conceptually, but the implementation has them as two separate data sources with no bridge.

**Plus, `rider.emergencyContact` is set by the backend during KYC** (the user types it during the user_onboarding form, per the audit #10 onboarding). The rider can never edit it from the app — there's no "edit emergency contact" UI on the profile. So the SOS screen shows a number the rider can't change, that the contacts screen doesn't manage.

**Repro:**
1. Onboard a rider (sets `rider.emergencyContact = "+91-98765-43210"` from the onboarding form).
2. Go to Profile → Emergency Contacts.
3. Add 2 real contacts (mom at +91-11111-11111, dad at +91-22222-22222).
4. Go to Profile → Emergency SOS.
5. **Observe:** the screen shows ONLY the onboarding-entered `+91-98765-43210` (or similar). The 2 added contacts are not visible. Tapping the card dials the onboarding-entered number, not the contacts they just added.

**Fix:** Rewrite `EmergencySOSScreen` to read from `EmergencyContactsNotifier`:
```dart
final service = ref.watch(emergencyContactsService);
final contacts = service.contacts;
final primary = service.primaryContact;
// Render all contacts (up to 5) as cards, with the primary marked
```
Optionally keep the backend's `rider.emergencyContact` as a fallback if the rider has not yet added any contacts.

**Effort:** 1-2h. **Risk:** Low. **Co-fix with:** P0-1 (the SOS action should notify these contacts).

---

### P0-4: The SOS action does NOT share the rider's location — the dispatcher can't find them

**File:** `flutter/lib/features/device_compliance/presentation/screens/emergency_sos_screen.dart` (the entire screen, no location call).

**What:** The SOS flow has zero location awareness. There is no `Geolocator.getCurrentPosition()` call, no `/api/emergency/sos` POST with coordinates, no `LocationAccuracyStatus` check. The snackbar message "Help is on the way" is **especially misleading** because there is no way for the help to find the rider without their location.

**Combined with P0-1** (no number is actually called, no alert is actually sent), the SOS is purely cosmetic. There is no path from "rider long-presses SOS" to "Voltium staff sees the rider's location on a map".

**Impact:** If a rider in a real emergency uses the SOS button and believes help is on the way, the dispatcher cannot locate them. The rider's only options are to manually call 112 or use the contact cards. The SOS button is misleading and dangerous in its current state.

**Fix:** Add location capture to the SOS action:
```dart
Future<void> _onSosTriggered() async {
  // Capture location first
  Position? position;
  try {
    position = await Geolocator.getCurrentPosition(
      locationSettings: LocationSettings(accuracy: LocationAccuracy.high),
    );
  } catch (e) {
    appDebug('SOS: location unavailable: $e');
  }
  
  // Send to backend
  await api.postEmergencySOS(EmergencySOSRequest(
    riderId: riderId,
    latitude: position?.latitude,
    longitude: position?.longitude,
    timestamp: DateTime.now().toIso8601String(),
    triggeredVia: 'app_sos_button',
  ));
  
  // Show follow-up
  ScaffoldMessenger.of(context).showSnackBar(...);
}
```

**Effort:** 1-2 days. **Risk:** High (touches the API, requires backend endpoint, requires location permission already granted via the permissions screen).

---

### P0-5: Zero integration tests for the entire emergency feature

**Files:** all of `flutter/integration_test/e2e_individual/`.

**What:** A `grep` for "emergency" or "sos" in the integration test directory returns 0 hits. The 33 integration tests cover splash, legal, permissions, login, OTP, dashboard, support, settings, rentals, kyc, referrals, wallet, profile — but **none cover the emergency feature**. This is the highest-stakes surface in the app and it has zero test coverage.

**Impact:** Any regression in the SOS flow goes undetected. The P0-1 no-op bug shipped because there's no test that asserts "tapping SOS calls the number". A future bug where the snackbar doesn't appear, or the location isn't shared, or the contact list doesn't render, would all ship silently.

**Fix:** Add at minimum:
1. `28_emergency_sos_test.dart` (or similar) — assert the SOS screen renders, the SOS button is present, the Police/Ambulance/Support cards are present, and that tapping the Police card dials 100.
2. `29_emergency_contacts_test.dart` — assert the contacts screen renders, the empty state appears for new users, adding a contact via the dialog persists.
3. A unit test for `EmergencyContactsNotifier` — assert `addContact` promotes to primary if first contact, `setPrimaryContact` correctly updates, `removeContact` reassigns primary to first remaining.

**Effort:** 1-2 days. **Risk:** Low.

---

## P1 — Next 2 sprints

### P1-1: `EmergencyContactsNotifier._hydrate()` runs in a `Future.microtask` inside `build()` — race condition

**File:** `flutter/lib/services/emergency_contacts_service.dart` lines 94-98.

**What:**
```dart
@override
EmergencyContactsState build() {
  Future.microtask(() => _hydrate());
  return const EmergencyContactsState();  // ← returns empty state
}
```

The notifier returns an empty `EmergencyContactsState` initially, then schedules a microtask to hydrate from SharedPreferences. The microtask runs after `build()` returns. **The first frame the screen renders, contacts is empty** — even if the user has 5 contacts in cache. The screen briefly shows the "No emergency contacts" empty state, then re-renders with the actual contacts.

This is the same anti-pattern I flagged in:
- `support_provider.dart` — `Future.microtask(() => fetchTickets())` inside `build()`
- `ticket_provider.dart` — same pattern

**Repro:**
1. Add 3 emergency contacts.
2. Cold-restart the app.
3. Navigate to the contacts screen quickly.
4. **Observe:** the empty state renders for ~50ms before the contacts appear. On a slow device, the flash is visible.

**Fix:** Move the hydration out of `build()` and into the provider's `init` or use a sync cache read:
```dart
@override
EmergencyContactsState build() {
  final prefs = SharedPreferences.getInstance();
  // Either: await the prefs synchronously, OR seed from a sync cache.
  return _hydrateSync();
}

EmergencyContactsState _hydrateSync() {
  // Read from a sync source (could be the same CacheService singleton
  // pattern as other preferences).
  final cached = CacheService().getEmergencyContacts();
  if (cached == null) return const EmergencyContactsState();
  return EmergencyContactsState(contacts: cached);
}
```

**Effort:** 30 min. **Risk:** Low.

---

### P1-2: `EmergencyContact.id` uses `DateTime.now().millisecondsSinceEpoch` — can collide if user adds 2 contacts in same millisecond

**File:** `flutter/lib/features/device_compliance/presentation/screens/emergency_contacts_screen.dart` line 154.

**What:** When the user adds a contact via the dialog:
```dart
EmergencyContact(
  id: DateTime.now().millisecondsSinceEpoch.toString(),
  ...
)
```

`DateTime.now().millisecondsSinceEpoch` returns the same value for all calls within the same millisecond. If the dialog is dismissed and re-opened within 1ms, two contacts could have the same ID. The contact list filtering and set-as-primary logic would break.

**More realistically:** if a tester (or a hot-reload during dev) creates 2 contacts in a tight loop, the IDs collide.

**Fix:** Use a UUID v4 or a `UniqueKey()`:
```dart
import 'package:uuid/uuid.dart';
final _uuid = const Uuid();
// ...
id: _uuid.v4(),
```

**Effort:** 5 min (add `uuid` to pubspec if not present, replace the call). **Risk:** Low.

---

### P1-3: Police `100` and Ambulance `108` are hardcoded — wrong for non-India deployments

**File:** `flutter/lib/features/device_compliance/presentation/screens/emergency_sos_screen.dart` lines 134-148.

**What:** India's emergency numbers are 100 (police) and 108 (ambulance). These are hardcoded in the SOS screen. If the app is deployed in a different country (the admin audit #6 mentioned a multi-tenant model — the same `Voltium` app could be deployed elsewhere), the numbers are wrong:
- US: 911
- UK: 999
- EU: 112 (general)
- Japan: 110 (police), 119 (ambulance)

The 112 fallback in the troubleshooter screen (`troubleshooter_screen.dart:215`) is the EU standard; using it in India works (the EU 112 is a redirect) but it's not the local number.

**Fix:** Add a regional emergency numbers config:
```dart
class EmergencyConfig {
  final String police;
  final String ambulance;
  final String fire;       // India: 101
  final String general;    // 112
}
```
Read from a `supportConfig` API endpoint (per support audit P1-1) or a `Constants` file. The current hardcoded `100`/`108` should be replaced with `config.police` / `config.ambulance`.

**Effort:** 1h. **Risk:** Low.

---

### P1-4: SOS is long-press only with no confirmation — accidental triggering locks the screen for 1 second

**File:** `flutter/lib/features/device_compliance/presentation/screens/emergency_sos_screen.dart` lines 72-108.

**What:** The SOS button requires a 1-second long-press. Once triggered, the snackbar appears. The user has no way to:
- **Cancel** the SOS after the long-press (it's already triggered)
- **Verify** the SOS was sent (the snackbar is the only feedback, and it's lying per P0-1)
- **See** the SOS in some "history" or "active" state

For a real safety feature, the UX should be:
- Long-press triggers a "Sending SOS..." spinner overlay
- A cancel button is shown for 5 seconds
- After 5 seconds, the SOS is confirmed and a "Your team has been notified" confirmation appears
- A "View status" link goes to a real status screen (not implemented)

**Plus, the current long-press has no haptic feedback.** A rider under stress wouldn't know if their long-press registered. The Material design pattern for destructive actions: haptic + visual progress (e.g., the button fills with color as the press holds).

**Fix:**
1. Add `HapticFeedback.heavyImpact()` on long-press start.
2. Add a visual progress indicator (the red circle "fills" over the 1-second hold).
3. After long-press completes, show a full-screen confirmation dialog with a "Cancel SOS" button visible for 5 seconds.
4. The cancel actually calls the backend to cancel.

**Effort:** 2-3h. **Risk:** Low.

---

### P1-5: No PostHog event for "emergency_contacts_viewed" or "contact_added" / "contact_removed" / "set_as_primary" — can't measure safety feature adoption

**File:** `flutter/lib/features/device_compliance/presentation/screens/emergency_contacts_screen.dart` (no PostHog calls).

**What:** The SOS screen fires `'emergency_sos_triggered'` on long-press (line 74), but the contacts screen fires nothing. A rider who adds 3 contacts, sets mom as primary, deletes dad — none of these are tracked. Voltium can't measure:
- What % of riders set up any emergency contact
- How many contacts per rider
- What relationships (parent / spouse / friend / sibling) are most common

**Fix:** Add PostHog events:
```dart
// On screen open
PostHogService.capture('emergency_contacts_viewed',
  properties: {'count': service.contacts.length});

// On add
ref.read(emergencyContactsService.notifier).addContact(contact);
PostHogService.capture('emergency_contact_added',
  properties: {'relationship': contact.relationship, 'is_primary': contact.isPrimary.toString()});

// On set primary
ref.read(emergencyContactsService.notifier).setPrimaryContact(id);
PostHogService.capture('emergency_contact_set_primary');

// On remove
ref.read(emergencyContactsService.notifier).removeContact(id);
PostHogService.capture('emergency_contact_removed');
```

**Effort:** 15 min. **Risk:** Low.

---

## P2 — Cleanup backlog

### P2-1: `EmergencyContactsScreen` is 415 lines with 2 inline widgets (`_ContactCard`, `_buildEmptyState`) — split for testability

The 2 widgets are private to the file. A refactor to `widgets/emergency/` would make each testable. ~150 lines moved.

**Effort:** 1h. **Risk:** Low.

### P2-2: `EmergencyContact.copyWith` doesn't allow changing the `id` — defensive but undocumented

```dart
EmergencyContact copyWith({
  String? name,
  String? phone,
  String? relationship,
  bool? isPrimary,
}) {
  return EmergencyContact(id: id, ...);
}
```

The `id` is never updated. The signature is fine, but worth a doc comment explaining the intent.

**Effort:** 5 min. **Risk:** Low.

### P2-3: `EmergencyContact.id` as a string — should be a typed value

The ID is a string but it's always used as an opaque identifier. A typedef `EmergencyContactId` or a typed wrapper would catch bugs:
```dart
typedef EmergencyContactId = String;
```

**Effort:** 5 min. **Risk:** Low.

### P2-4: `_ContactCard` shows `contact.name[0].toUpperCase()` (line 204) — same `substring(0, 1)` bug as the settings audit P1-6 (breaks for emoji / grapheme names)

**File:** `flutter/lib/features/device_compliance/presentation/screens/emergency_contacts_screen.dart` line 204.

Same fix as audit P1-6: use `String.characters.first` from the `characters` package.

**Effort:** 5 min. **Risk:** Low.

---

## Recommended fix order

| # | Item | Section | Effort | Risk |
|---|---|---|---|---|
| 1 | **P0-5** Add emergency integration tests (minimum 2 test files) | integration_test/ | 1-2 days | Low |
| 2 | **P0-2** Replace hardcoded `+91-9876543210` with `SupportConfig.supportPhone` | emergency_sos_screen + locale_provider | 30min | Low |
| 3 | **P0-3** Make `EmergencySOSScreen` read from `EmergencyContactsNotifier` | emergency_sos_screen | 1-2h | Low |
| 4 | **P1-2** Use UUID for `EmergencyContact.id` | emergency_contacts_screen | 5min | Low |
| 5 | **P1-1** Fix `_hydrate` race condition in `EmergencyContactsNotifier.build()` | emergency_contacts_service | 30min | Low |
| 6 | **P1-5** Add PostHog events for contact CRUD | emergency_contacts_screen | 15min | Low |
| 7 | **P1-3** Add regional emergency numbers config | emergency_sos_screen + support_config | 1h | Low |
| 8 | **P1-4** Add SOS confirmation dialog with cancel + haptic feedback | emergency_sos_screen | 2-3h | Low |
| 9 | **P0-4** Capture location on SOS trigger | emergency_sos_screen + Geolocator | 1-2h | Medium |
| 10 | **P0-1** Wire SOS to backend API (POST /api/emergency/sos) | emergency_sos_screen + API + FCM | 1-2 days | High |

**Suggested PR shape (each shippable independently):**
- **PR: "P0-2 + P0-3 + P1-1 + P1-2 + P1-5 + P1-6 — emergency cleanup"** — 6 small fix-one-thing PRs. ~30 lines, 3 files. Quick wins.
- **PR: "P0-5 + P1-3 — emergency tests + regional config"** — 1-2 days, 3 files. Test + config.
- **PR: "P1-4 — SOS confirmation dialog"** — 2-3h, 1 file. UX hardening.
- **PR: "P0-1 + P0-4 — real SOS (dial + location + backend)"** — 1-2 days, 3 files + API. **This is the safety PR — should be the highest-priority emergency fix.**

---

## Tests gap analysis

| Section | Existing test | What's missing |
|---|---|---|
| **SOS screen** | None (0 tests) | The P0-1 no-op bug. The P0-2 placeholder number. The P0-3 disconnected contacts. The P1-4 long-press confirmation. |
| **Contacts screen** | None (0 tests) | The empty state. The P1-2 ID collision. The P1-5 missing PostHog. The delete confirmation. |
| **EmergencyContactsNotifier** | None | The P1-1 _hydrate race. The primary promotion logic. The removeContact's auto-reassign-primary. |
| **Rider flow** | None | The "rider in emergency taps SOS" → "what happens" flow. |

**The 0 emergency tests is the most damning test gap in the codebase.** The support, settings, and rentals features all have at least 1 smoke test. Emergency has nothing.

The most valuable tests to add (in priority order):
1. **P0-1 test:** tap SOS → assert a number is dialed (or a backend API is called). The current no-op behavior would fail this immediately.
2. **P0-3 test:** add 2 contacts → open SOS screen → assert both contacts are rendered.
3. **P0-5 integration test:** open Profile → tap Emergency SOS tile → assert the SOS screen renders with the big red button + contact cards.
4. **P1-1 unit test:** `EmergencyContactsNotifier.build()` returns cached contacts synchronously (not after a microtask).
5. **P1-2 unit test:** add 2 contacts in same millisecond → assert they have different IDs.

---

## Architecture observations (informational)

1. **The `features/device_compliance/` feature directory is misnamed.** It contains 2 emergency-related screens and 1 device-policy provider. The directory's intent (per the name) is device compliance — battery / permissions / device admin. The emergency screens are an unrelated feature squashed in because there's no `features/emergency/` directory. A refactor to `features/emergency/` would be cleaner.

2. **The `EmergencyContactsNotifier` and `RiderModel.emergencyContact` are two parallel systems for the same concept.** The rider model has a single `emergencyContact` string (set at KYC, can't be edited by the rider). The notifier has a list of 5 contacts (editable by the rider, persisted locally). The two never sync. A refactor to one canonical source (the notifier) would be cleaner. The `rider.emergencyContact` field could be removed entirely once the notifier is the source of truth.

3. **The `_hydrate` race condition is the same anti-pattern across at least 3 providers** (support tickets, support, emergency contacts). A unified `HydratableNotifier` base class or a sync cache read pattern (like `CacheService.getRider()`) would solve all 3 in one PR.

4. **The SOS long-press is the only "destructive" interaction in the rider app that requires holding for 1 second.** No other action uses a long-press. This is unusual for mobile UX. A safer pattern: a tap that opens a "Are you sure?" confirmation, with the tap itself on a red destructive background. Long-press is rare and undiscoverable.

5. **The Police/Ambulance cards and the "Voltium Support" card all do `_callNumber()` (line 14-20)** — a private method that just opens the dialer. The "My Emergency Contact" card also uses it. **The SOS button does NOT use it.** The SOS button is less functional than the contact cards it sits above. The visual hierarchy (SOS is bigger and more prominent) suggests it's the most important action, but the contact cards are the most functional.

6. **The `EmergencyContact` model has `isPrimary` (a bool on the contact) AND there's a `primaryContact` getter on the state.** The two can diverge: if a contact has `isPrimary: true` but isn't the first in the list, the getter returns it correctly. If NO contact has `isPrimary: true`, the getter returns `contacts.first`. This is a defensive design but means the `isPrimary` bool is the source of truth. The state has no "is this contact primary?" method — callers do `contact.isPrimary`. The pattern is consistent but a `bool isPrimaryFor(String id)` method on the state would be cleaner.

7. **The `_showAddContactDialog` method creates local `TextEditingController`s that are disposed AFTER the `await showDialog` returns** (line 168-169). If the dialog is dismissed by tapping outside (barrierDismissible: true), the `await` still resolves, the controllers are disposed. But the controllers' text is discarded without saving. If the user accidentally taps outside, they lose what they typed. A `WillPopScope` or a "discard?" confirmation would be safer.

8. **The `EmergencyContactsScreen` has a hardcoded `_maxContacts = 5`** in the notifier (line 92 of the service). The screen shows the FAB only if `contacts.length < 5` (line 60). The `addContact` throws if at max (line 124-126). The 5-contact limit is hardcoded with no backend override. Worth a `Constants.emergencyContactsMax = 5` or a config field.

9. **The `_hydrate` pattern (`Future.microtask(() => _hydrate())`)** means the first frame renders with the empty state. A user with 5 contacts who navigates to the contacts screen quickly sees the empty state for ~50-200ms. This is a "flash of unstyled content" that erodes trust. The fix (sync cache read) is small but requires a `CacheService` extension.

10. **The TroubleshooterScreen's `_triggerSOS` is the only "DANGER" outcome handler** (line 533-543). When the troubleshooter result is `DANGER`, the screen shows a `TroubleshooterSosButton` that calls `_triggerSOS`. The dialog confirms and dials `112`. This is a different flow from the main SOS screen — it's contextual SOS for a specific danger. Worth a unified SOS handler that captures the context (which danger the rider encountered) and sends it to the backend.

---

## Out-of-scope notes

- **The web's emergency features** — the web admin (per the admin audits) has no SOS/contacts management. The rider web app probably doesn't either. The mobile is the only SOS surface.
- **The `device_policy_provider`** is in `features/device_compliance/` but is unrelated to emergency. It's about device admin / battery / permissions. The directory is misnamed.
- **The `troubleshooter_screen.dart::_triggerSOS`** is a separate SOS path that dials `112` on DANGER results. It's well-implemented (confirm dialog + dial). The main SOS screen's long-press should follow the same pattern (confirm + dial + backend call) instead of being a snackbar-only no-op.
- **The `ProfileEmergencySosTile`** (in `profile_widgets.dart`) is the entry point on the profile screen. The workflow hub has a separate tile. **There are 2 entry points to the SOS screen** (profile + workflow hub), consistent with the 8-pushed-screens pattern flagged in earlier audits.
- **The Emergency Contact is the rider's safety net** — but the rider can't edit the single `rider.emergencyContact` field. They can only add to the local list of 5. The KYC onboarding form captures the emergency contact during `user_onboarding_screen.dart` (per audit #10), but there's no "edit later" path. A rider whose emergency contact changes (e.g., parent's phone changes) cannot update it from the app.
- **The "Voltium Support" placeholder phone `+91-9876543210`** is the same number across at least 4 files now (support, faq, splash, legal_page, and now emergency_sos). The cross-audit P1-1 from support and the P1-2 from dark-mode/language have both flagged the brand consistency debt. The emergency SOS screen is the **most dangerous** place to have a wrong number.
- **The `EmergencyContact.id` collision risk** is low (millisecond collisions are rare in normal user flow) but a tester doing rapid add/delete could hit it. The UUID fix is trivial.
- **The `_hydrate` race condition** is invisible to most users but affects every user on cold start. The fix is a sync cache read.
- **The "press and hold" pattern** for SOS is uncommon in mobile apps. Material guidelines suggest destructive actions should have explicit confirmation. A long-press that silently triggers (even if it then shows a snackbar) is not the right pattern. Consider a tap → confirmation dialog → dial + alert flow.
- **The entire emergency feature has 0 integration tests.** This is the most test-gap-critical surface in the app. The fix is straightforward (write the tests) but the priority is high.
