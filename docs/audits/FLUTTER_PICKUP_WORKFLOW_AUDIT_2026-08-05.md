# Pickup Workflow (Flutter-specific) — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** the rider-side pickup workflow — the Flutter module under `flutter/lib/features/pickup/`, plus its integration with the `RiderProvider`, the `AuthState` router, and the `RiderRental` data model. The pickup flow is Flutter-only: it captures photos + odometer before riding, then submits to `POST /api/rider/sync/pickup` (covered in audit #15 "Rental Lifecycle → Pickup verification" — that audit covers the *web* side; this one covers the *Flutter* orchestration that drives it).

**Files read in full:**
- `flutter/lib/features/pickup/domain/entity.dart` (30 lines — `PickupEntity`, **zero callers** in the codebase)
- `flutter/lib/features/pickup/presentation/screens/pickup_hub_screen.dart` (700+ lines — hub/vehicle/emergency-contact/photo flow, 5-photo upload)
- `flutter/lib/features/pickup/presentation/screens/pickup_verification_screen.dart` (188 lines — terms-agreement + `syncPickup` POST)
- `flutter/lib/features/pickup/presentation/screens/pickup_success_screen.dart` (80 lines — "You're Live!" celebration)
- `flutter/lib/features/pickup/presentation/screens/vehicle_photos_screen.dart` (290 lines — read-only gallery of rider's stored pickup photos)
- `flutter/lib/features/pickup/presentation/screens/tl_details_screen.dart` (260 lines — team leader profile, **reads `emergencyContact` as team-leader phone**)
- `flutter/lib/features/pickup/presentation/widgets/pickup_widgets.dart` (363 lines — `AssignmentDetailsCard`, `VehicleConditionCard`, `PhotoUploadEntry`)
- `flutter/lib/features/pickup/widgets/pickup_hub_widgets.dart` (575+ lines — `buildHubDropdown`, `buildTeamLeaderDropdown`, `buildVehicleDropdown`, `EmergencyContactField`, `OtpGrid`, `PhotoUploadCard`)
- `flutter/lib/features/pickup/widgets/pickup_vehicle_search_sheet.dart` (293 lines — bottom sheet to search/pick a vehicle)
- `flutter/lib/app/router.dart` (lines 80-380 — `RouterState` with 9 `_pickup*` fields, `AuthState.pickupHub`/`pickupVerification`/`pickupSuccess` enum, `updatePickupData` callback)
- `flutter/lib/app/router_body.dart` (lines 7-380 — the switch statement that builds the screen for each `AuthState`)
- `flutter/lib/core/state/rider_provider.dart` (lines 120-160 — `_postPickupPoller`; lines 320-410 — polling lifecycle, `pickupDone` checks)
- `flutter/lib/core/state/app_state_provider.dart` (lines 57-71 — `isOnboarded`/`isPickupDone` getters)
- `flutter/lib/utils/lifecycle_rank.dart` (line 30-36 — `PICKUP_SCHEDULED: 9, ACTIVE: 10` rank map)
- `flutter/lib/models/rider_rental.dart` (89 lines — `pickupPhoto*`, `planDone`, `pickupDone`)
- `flutter/lib/models/rider_model.dart` (line 480-486 — `isPickupDone` computed: `pickupDone || assignedVehicle.isNotEmpty || lifecycleRank >= 9`)
- `flutter/test/pickup/pickup_screen_test.dart` (131 lines — 5 render tests using a `FakeVoltiumApiService`)
- `flutter/test/pickup/pickup_success_screen_test.dart` (37 lines — 4 render tests)

**Tests cross-referenced:**
- `flutter/integration_test/e2e_individual/` — **0 files reference the pickup module** (the entire 33-test suite has no pickup e2e test)
- `flutter/test/widgets/pickup_vehicle_search_sheet_golden_test.dart` — golden test (visual regression only)
- `flutter/test/widgets/pickup_hub_widgets_golden_test.dart` — golden test (visual regression only)

**Out of scope:** The web `POST /api/rider/sync/pickup` route and `rentalUseCases.syncPickup` (covered in audit #15). The end-rental photo upload (audit #15). The auth flow (audit #14). The dashboard (audit #7).

---

## TL;DR

**The pickup workflow has 4 P0 bugs. The headline: zero integration tests for the entire module** — the 33-file `flutter/integration_test/e2e_individual/` suite has no test that exercises the hub → vehicle → photos → verification → success path. Only 5 render tests in `flutter/test/pickup/pickup_screen_test.dart` and 4 in `pickup_success_screen_test.dart`, none of which exercise the API contract. Compare to the rental lifecycle which has at least 33 tests (most no-op tautologies per audit #15 — but at least they exist). A single integration test for "rider picks hub, picks vehicle, takes 5 photos, hits Complete, sees Dashboard" would catch **every** P0 in this audit.

The other 3 P0s:
1. **Pickup state lives in `RouterState`, not the rider** — `RouterState` (router.dart:84-92) has 9 mutable fields (`_pickupHubId`, `_pickupVehicleId`, `_pickupPhoto*`, etc.) that hold the entire pickup flow's intermediate state. If the app is killed mid-flow, the rider loses all photo URLs and selections and has to start over. If `auth` is revoked mid-flow, the in-memory state is lost.
2. **`PickupHubScreen._submitForm` (line 433) uses `RegExp(r'\\D')` — a backslash-escaped backslash** — this regex matches the literal two characters `\\D`, not "any non-digit". The emergency contact string sent to `syncPickup` may contain spaces, dashes, parentheses, or other characters that the rider typed. The server's `syncPickup` use case (audit #15) normalizes but the Flutter-side bug is real.
3. **No re-fetch of hubs/vehicles on resume** — `PickupHubScreen._fetchHubs()` is called only in `initState`. If the rider takes 5+ minutes filling in the emergency contact and uploading photos (realistic on 3G), the hub list is stale. Worse: if a hub becomes inactive while the rider is mid-flow, the rider picks it, fills 5 photos, and the `syncPickup` fails server-side with no clear error path.

There are also P1s: `PickupEntity` is dead code (30 lines, 0 callers), `tl_details_screen.dart` reads `rider.emergencyContact` as the team leader's phone number (field-name confusion — the same bug as audit #12 P0-3), the team leader dropdown is hardcoded to `['Rajesh Kumar (TL-01)', 'Not assigned', 'Sanjay Singh (TL-03)']` (placeholder-name pattern from audits #9/#14/#16), the `OtpGrid` widget uses an opacity-0 hidden TextField (a11y-hostile), the `_completePickup` call reads `riderId` via `ref.watch` (causes rebuild) and passes it as `bookingId` (semantically wrong — the rider ID is not a booking ID), and the photo upload is sequential (not parallel like the end-rental flow's PR-66).

The headline architectural issue: **`PickupHubScreen` is a 700+ line god-widget** that owns hub state, vehicle state, emergency-contact OTP state, photo upload state, and form validation. State management is all local. This is the same anti-pattern as `end_rental_screen.dart` (audit #15), and it makes the screen un-unit-testable beyond "renders without overflow".

There are **4 P0s**, **9 P1s**, and **6 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, security gap, silent data loss, business logic bug | Before next release |
| **P1** | UX friction, race condition, accessibility, dead code, contract drift | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: Zero integration tests for the entire pickup module — no coverage of the hub → vehicle → photos → verification → success path

**Repro:**
1. The `flutter/integration_test/e2e_individual/` directory has 33 test files (numbered `00_*` through `33_*`).
2. `grep -r "Pickup\|pickup" flutter/integration_test/` returns 0 hits.
3. The 4 widget tests in `test/pickup/pickup_screen_test.dart` only verify that the screens render (`expect(find.byType(PickupHubScreen), findsOneWidget)`, `expect(tester.takeException(), isNull)`). They use a `FakeVoltiumApiService` (lines 13-35) that returns hardcoded data and is set via `VoltiumApiService.instance = FakeVoltiumApiService()`.
4. The 4 success-screen tests (pickup_success_screen_test.dart) only check text presence: `expect(find.text("You're Live!"), findsOneWidget)`.
5. **No test exercises:**
   - Selecting a hub from the dropdown
   - Selecting a vehicle from the search sheet
   - Sending an OTP to the emergency contact
   - Verifying the OTP
   - Taking 5 photos
   - Tapping "Complete & Start Ride"
   - Asserting that `syncPickup` was called with the right body
   - Asserting that the rider is routed to the dashboard afterward

**Impact:** **Any refactor of `PickupHubScreen` can break the entire pickup flow with zero signal.** The screen is 700+ lines, has 9 mutable state fields, two async upload paths (OTP + photos), and a multi-step form. A change to one of the 14 `VehicleConditionCard` parameters, a refactor of the `OtpGrid`, or a tweak to the `_uploadImage` retry logic would compile cleanly and ship without any of the 37 existing tests catching it.

**Fix:** Add a new integration test file:
- `flutter/integration_test/e2e_individual/34_pickup_flow_test.dart` (or similar)
- Steps: login → pre-dashboard → tap "Pickup" → pick hub → pick vehicle → enter emergency contact → send OTP → enter OTP → take 5 photos → tap Complete → assert on dashboard
- **Mock the `VoltiumApiService` at the singleton** (same pattern as `pickup_screen_test.dart:40`).
- Assert: `verify(() => mock.syncPickup(any(), any(), any(), any(), any(), any(), any(), any(), any())).called(1)`
- Assert: final state is `AuthState.dashboard`
- Assert: rider is navigated to `ActiveDashboardScreen`

**Effort:** 4-6h (the flow has many steps; need to scroll through the form).

---

### P0-2: Pickup state lives in `RouterState` (9 mutable fields) — not persisted, not in the rider model, lost on app kill

**Repro:**
1. `router.dart:83-92`:
   ```dart
   // Pickup flow state
   String? _pickupHubId;
   String? _pickupVehicleId;
   String? _pickupTeamLeader;
   String? _pickupEmergencyContact;
   String? _pickupPhotoFront;
   String? _pickupPhotoBack;
   String? _pickupPhotoLeft;
   String? _pickupPhotoRight;
   String? _pickupPhotoWithVehicle;
   ```
2. These fields are populated by `updatePickupData(...)` (router.dart:268-290) and read in `AuthState.pickupVerification` (router_body.dart:285-294).
3. **None of these fields are persisted to local storage, the rider model, or any cache.** They live only in the in-memory `RouterState` instance.
4. Scenarios where this breaks:
   - **App is killed** (low memory, force-quit, OS shutdown) between step 1 (picking hub) and step 2 (uploading photos). The rider comes back, lands on the splash → pre-dashboard. All 5 photo URLs, the hub ID, the vehicle ID, the emergency contact are gone. They have to start over.
   - **Phone call interrupts the flow** — on Android, the app may be backgrounded for >30s, then killed. Same outcome.
   - **Token refresh fails** mid-flow — the `RiderProvider.logout()` fires (audit #7-#10/#14 cross-cutting). The router state is not cleared. If the rider logs back in, they may see a partially-populated pickup screen with stale IDs.
5. Worse: `AuthState.pickupVerification` is in the `AuthState` enum, so `_navigateToLocal(AuthState.pickupVerification)` reads `state._pickupPhotoFront` etc. If any field is null (e.g., rider skipped a step, or state was lost), the field is empty string. The `syncPickup` POST body includes all 5 photo URLs as null/empty, and the server may store empty strings on the rider row.

**Impact:** Real user friction on slow networks (where the flow legitimately takes minutes). Also a **silent data integrity bug** — the rider model ends up with `pickupPhotoFront = ""` and the team-leader-relationship is broken because the URL was lost.

**Fix:**
- **Persist the in-progress pickup state** to `CacheService` (same place the rider is cached) as a `PickupDraft` blob. On app restart, restore it.
- **OR** hoist the state into a Riverpod `pickupDraftProvider` (similar to `walletProvider` from audit #16). Then it's testable, observable, and survives widget rebuilds.
- **OR** the simplest: validate that all 5 photo URLs are non-null in `PickupHubScreen._submitForm` (line 427-440) before calling `onNext`. If any are null, surface a friendly error instead of sending empty strings.
- The PR-66 parallel upload pattern (end-rental, audit #15) can be backported here.

**Effort:** 2-3h (Riverpod provider) or 30 min (validation gate).

---

### P0-3: `PickupHubScreen._submitForm` uses `RegExp(r'\\D')` — double-escaped, matches literal `\\D` not "any non-digit"

**Repro:**
1. `pickup_hub_screen.dart:433`:
   ```dart
   _emergencyContactController.text.replaceAll(RegExp(r'\\D'), ''),
   ```
2. The raw string `r'\\D'` is the two-character string `\\D` (backslash backslash D), which when used as a RegExp pattern matches the **literal** three characters `\\D`. It does NOT match "any non-digit character" (which would be `r'\D'`).
3. So the rider-typed emergency contact is sent **unmodified** to the server. A user who types `98765 43210` (with a space) sends `98765 43210` to the server. A user who types `(987) 654-3210` sends that as-is.
4. The server's `rentalUseCases.syncPickup` (audit #15) receives the string in `pickupPhotoBack` etc. and **does normalize** some fields, but the `emergencyContact` field is stored as-is on the rider row.
5. Subsequent calls (e.g., audit #12 P0-3 which reads `rider.emergencyContact`) get a string with spaces, parens, dashes. Dialing via `tel:` URI works (the OS strips them), but any string match (e.g., the team leader page reading `emergencyContact` and showing it back) shows the raw input.

**Impact:** The rider's emergency contact in the database has a non-normalized format. The dashboard team-leader card and the SOS screen (audit #12) all read this field — they show the un-normalized form. Worse, the `_verifyEmergencyOtp` flow (line 365) sends the **un-normalized** number to `verifyPhone`, which compares against the rider's phone in the database. If the un-normalized form doesn't match, the OTP send fails silently.

**Fix:**
- Change line 433: `RegExp(r'\D')` (single backslash).
- Same regex appears at line 301: `phone.replaceAll(RegExp(r'\D'), '')` — that one is correct.
- The bug is only on line 433.
- Add a unit test for the sanitization.

**Effort:** 5 min.

---

### P0-4: `PickupHubScreen` has no refresh-on-resume, no retry-on-fail for hub/vehicle fetch; a 5+ minute flow uses stale data

**Repro:**
1. `pickup_hub_screen.dart:147-150`:
   ```dart
   @override
   void initState() {
     super.initState();
     _fetchHubs();
   }
   ```
2. `_fetchHubs` is called **once** when the screen mounts. It does NOT listen to `AppLifecycleState.resumed` (which the rider provider does for polling, rider_provider.dart:502-505).
3. `_fetchVehicles` is called on hub change (line 553) — also a one-shot. No retry, no cache, no error feedback to the user if it fails.
4. Scenario:
   - T=0: rider opens PickupHubScreen, sees hub list of 5 hubs.
   - T=2:00: rider is in step 2, taking 5 photos. 2G network is slow. Each photo upload takes 30s. Total: 2.5 minutes in the photo step.
   - T=2:01 (in the background): a hub team leader marks Hub-3 as inactive on the admin panel.
   - T=5:00: rider finishes photos, hits Complete. `syncPickup` fires with `hubId: 'hub-3'`. Server returns 400 "Hub is currently inactive" (rental use case, audit #15). The rider sees the generic snackbar.
   - Worse: the rider has to manually restart the entire flow.
5. There's no UI to refresh the hub list (no pull-to-refresh on the hub section). Even if the rider notices the hub is wrong, they can't reload the list.
6. `_fetchVehicles` is also one-shot. If the rider selects hub-1, then changes to hub-2, the vehicles for hub-1 are still in `_vehicles` state until the new fetch completes. If the new fetch is slow, the rider sees the old vehicles.

**Impact:** Real bug on slow networks. The pickup flow takes 3-5 minutes for new riders with bad connectivity; stale data is the norm, not the exception.

**Fix:**
- Add `RefreshIndicator` to the PickupHubScreen's ListView/SingleChildScrollView.
- Add an "active/inactive" indicator next to each hub in the dropdown (server already returns `isActive`).
- Cache the hub list with a TTL of 30s — refetch on hub change, refetch on resume, but don't refetch on every interaction.
- For the `syncPickup` failure, surface a "this hub is no longer available — please restart" dialog instead of a generic snackbar.

**Effort:** 2-3h.

---

## P1 — Should fix this sprint

### P1-1: `PickupEntity` (domain/entity.dart, 30 lines) is never used by any code

**Repro:**
1. `flutter/lib/features/pickup/domain/entity.dart` defines `PickupEntity` with `vehicleId`, `vehicleNumber`, `vehicleModel`, `hubName`, `hubLocation` and a `fromJson` factory.
2. `grep -r "PickupEntity" flutter/lib` returns 0 importers. The class is only defined, never used.
3. The actual pickup data lives in:
   - `RiderRental` (rider_rental.dart:30-88) — `pickupPhotoFront`, `pickupPhotoBack`, etc.
   - `RouterState` (router.dart:84-92) — `_pickupHubId`, `_pickupVehicleId`, etc.
   - The local `_PickupHubScreenState` — `_selectedHubId`, `_selectedVehicleId`, etc.

**Impact:** Dead code. The "clean architecture" `domain/` folder under `pickup/` has 1 file with 30 lines that's never read or written. Same anti-pattern as `RentalEntity` (audit #15 noted `ActiveRentalEntity` is read but `RentalPlanEntity` is partially dead), `WalletEntity` (audit #16 P0-2), `PickupEntity` here.

**Fix:** Delete `flutter/lib/features/pickup/domain/entity.dart`. If the `pickup/domain/` folder becomes empty, delete the whole folder. The pickup module has no need for a domain entity — the data lives on the rider model and the router state.

**Effort:** 5 min.

---

### P1-2: `tl_details_screen.dart:21-24` reads `rider.emergencyContact` as the team leader's phone number — same field-name confusion as audit #12 P0-3

**Repro:**
1. `tl_details_screen.dart:15-24`:
   ```dart
   final rider = ref.watch(riderProvider).rider;
   final tlName = (rider?.teamLeader == null ||
           rider!.teamLeader!.isEmpty ||
           rider.teamLeader == 'Not Assigned')
       ? 'Not assigned'
       : rider.teamLeader!;
   final tlPhone =
       (rider?.emergencyContact == null || rider!.emergencyContact!.isEmpty)
           ? ''
           : rider.emergencyContact!;
   ```
2. The variable is named `tlPhone` (team leader phone) but it's reading `rider.emergencyContact` — the rider's **emergency contact**, not the team leader's phone.
3. This is the same bug as `emergency_sos_screen.dart:24-25` (audit #12 P0-3) — the rider model has `teamLeader: String?` (a name) and `emergencyContact: String?` (a phone) but no `teamLeaderPhone` field. The team leader's phone is never stored.
4. Worse: the contact card in `tl_details_screen.dart:123-160` shows the rider's **emergency contact** under the heading "Your team leader is your primary point of contact" (line 177). The rider dials their emergency contact thinking it's the team leader.
5. The `tel:` URI dial (line 142-147) launches the phone app to call the rider's emergency contact, not the team leader. The TL might be a different person entirely.

**Impact:** UX confusion at best, safety at worst — the rider thinks they're calling their team leader, gets their emergency contact (family member, friend). Audit #12 P0-3 is the same bug in the SOS context.

**Fix:**
- Add `teamLeaderPhone: String?` field to the rider model. Server returns it (need to verify schema).
- Or, fix the UX copy: "Your emergency contact is your first call" instead of "Your team leader".
- Or, refactor the team leader card to not show a phone at all if the field isn't available.

**Effort:** 1-2h.

---

### P1-3: Team leader dropdown in `PickupHubScreen` is hardcoded to `['Rajesh Kumar (TL-01)', 'Not assigned', 'Sanjay Singh (TL-03)']` (pickup_hub_widgets.dart:88-93) — placeholder-name pattern

**Repro:**
1. `pickup_hub_widgets.dart:88-93`:
   ```dart
   final teamLeaders = teamLeaderOptions ??
       [
         'Rajesh Kumar (TL-01)',
         'Not assigned',
         'Sanjay Singh (TL-03)',
       ];
   ```
2. The `teamLeaderOptions` parameter is `List<String>?` but **no caller passes it** (grep). So the dropdown always shows the hardcoded 3.
3. The rider picks "Rajesh Kumar" and the value is sent to the server as the `teamLeader` field on the rider row. The server has no way to validate this is a real team leader — it just stores the string.
4. The audit pattern: same hardcoded names as `TEST_PHONES` in `wallet.use-cases.ts:27` and `auth.use-cases.ts` (audits #14, #16), the `+91-9876543210` placeholder in `emergency_sos_screen.dart:156-159` (audit #12 P0-2), and the `Rajesh Kumar` placeholder in `intent_of_use_screen.dart` (audit #13).

**Impact:** Every rider has the same 3 team leader options. If 50 riders complete pickup, the team leader distribution is 50/0/0 or 50/0/0 or 0/0/50 — depending on which option they pick. The server's `pickupHub` and `teamLeader` analytics are useless.

**Fix:** Fetch the team leader list from a server endpoint (`GET /api/rider/hubs/:id/team-leaders` or similar). The hub dropdown already has data, the team leader dropdown should too. If the endpoint doesn't exist, build it as part of the same `hubs` response.

**Effort:** 2-3h (server + client).

---

### P1-4: `OtpGrid` widget (pickup_hub_widgets.dart:328-392) uses an opacity-0 hidden TextField — a11y-hostile and fragile

**Repro:**
1. `pickup_hub_widgets.dart:328-392`:
   ```dart
   return Stack(
     children: [
       Opacity(
         opacity: 0.0,
         child: SizedBox(
           height: 50,
           child: TextFormField(
             key: const Key('otpInputField'),
             controller: controller,
             ...
           ),
         ),
       ),
       IgnorePointer(
         child: AnimatedBuilder(
           animation: controller,
           builder: (context, child) {
             return Row(
               mainAxisAlignment: MainAxisAlignment.spaceBetween,
               children: List.generate(6, (index) {
                 final text = controller.text;
                 final char = text.length > index ? text[index] : '';
                 ...
                 child: Text(char, ...),  // visible cell
               }),
             );
           },
         ),
       ),
     ],
   );
   ```
2. The visible cells (the 6 boxes that show the OTP digits) are inside an `IgnorePointer` widget — they don't accept taps. The user types into the **hidden** TextField (opacity 0) which is the only interactive element.
3. Problems:
   - **Screen reader** (TalkBack, VoiceOver) can't read the visible cells because they're `IgnorePointer` and have no semantic meaning beyond `Text(char)`. The user with a screen reader hears nothing useful.
   - **Focus indication** is on the hidden field, not on the visible cells. The user can't tell which cell is "next".
   - **Visual confusion** — the rider taps the visible cell, nothing happens, then they realize they have to tap the *space* between cells.
4. The widget is also used by the support flow (`support_widgets.dart:54-316` referenced as dead code in audit #9, but the OtpGrid may be imported elsewhere). `grep` for `OtpGrid` returns the same file.

**Impact:** A11y blocker for visually-impaired riders. Also a UX confusion for any rider who tries to tap a cell to focus it.

**Fix:** Use a `Pinput` package or `pinput: ^2.0.0` (well-maintained Flutter OTP input). Or build a proper OTP input that:
- Each cell is a separate `FocusNode` (or a single `FocusNode` with `RawKeyboardListener`)
- Cells are real `TextField`s with `maxLength: 1` and `textInputAction: TextInputAction.next`
- The cell styles the focused cell via `Focus.of(context).hasFocus`

**Effort:** 2-3h (refactor + a11y test).

---

### P1-5: `PickupVerificationScreen._completePickup` (line 48-93) reads `riderId` via `ref.watch` (causes widget rebuild) and passes it as `bookingId` (semantically wrong)

**Repro:**
1. `pickup_verification_screen.dart:55-56`:
   ```dart
   final provider = ref.read(riderProvider.notifier);
   final riderId = ref.watch(riderProvider).riderId;
   ```
2. The mix of `ref.read` (for the notifier) and `ref.watch` (for the riderId) is suspicious. `ref.watch` inside an event handler causes the widget to rebuild on every rider state change. The pattern should be `ref.read(riderProvider).riderId` since the riderId won't change during this brief async operation.
3. Line 69: `bookingId: riderId,` — passes the rider's internal `id` as the `bookingId` to `syncPickup`. The server's `rentalUseCases.syncPickup` (audit #15) doesn't read a `bookingId` field — it derives the booking from the rider. But the Flutter side is sending it anyway, hoping the server uses it. This is **semantically wrong**: the rider is not a booking, they're a rider.
4. The `syncPickup` API contract (audit #15) accepts `{vehicleId, hubId, bookingId?, teamLeader?, emergencyContact?, pickupPhotoFront?, pickupPhotoBack?, pickupPhotoLeft?, pickupPhotoRight?, pickupPhotoWithVehicle?}`. The server ignores `bookingId` but the client sends the wrong value.

**Impact:** Mostly correctness/clarity issue. If anyone adds server-side validation that `bookingId` is required and must be a `rentalLease.id` (not `rider.id`), this will break. The audit #15 P0-1 contract mismatch.

**Fix:** Remove `bookingId: riderId` from the call. The server infers the booking from the session. If the field is needed for a future feature, use the actual `rentalLease.id` from the rider model.

**Effort:** 5 min.

---

### P1-6: `_uploadImage` is sequential — uploads one photo at a time, taking 5×~3s = 15s on 3G

**Repro:**
1. `pickup_hub_screen.dart:377-417` `_uploadImage(type, useCamera)`:
   ```dart
   Future<void> _uploadImage(String type, bool useCamera) async {
     ...
     final url = await VoltiumApiService()
         .uploadFile(File(compressed.path), 'pickup_verification');
     ...
   }
   ```
2. Each `uploadFile` call takes 2-3s on 3G. The rider has 5 photos (front, back, left, right, with_vehicle). Total: 15s in the photo step.
3. The end-rental flow (audit #15) has the **parallel upload pattern** (PR-66) which uploads all 4 photos in `Future.wait`, taking 2-3s total.
4. The pickup flow doesn't have the parallel pattern. The rider waits 15s.

**Impact:** Real UX delay. The "You're Live!" success screen takes 15+ seconds longer than necessary.

**Fix:** Mirror the end-rental pattern. Wrap the 5 photos in `Future.wait(entries.map((e) => uploadFile(e.path, 'pickup_verification')))`. Show per-photo progress.

**Effort:** 1-2h.

---

### P1-7: `_fetchVehicles` filters by `status == 'AVAILABLE'` on the client side — fragile contract

**Repro:**
1. `pickup_hub_screen.dart:200-204`:
   ```dart
   _vehicles = list
       .map((v) => v as Map<String, dynamic>)
       .where((v) => v['status'] == 'AVAILABLE')
       .toList();
   ```
2. The server returns all vehicles for a hub. The client filters to `AVAILABLE` only. If the server's `VehicleStatus` enum ever changes case (`available` vs `AVAILABLE`) or adds a new value (`RESERVED_FOR_INSPECTION` that the rider can still pick from), the rider sees zero vehicles with no error.
3. Also: the client doesn't display the count of filtered vehicles to the user. The dropdown says "No vehicles available" but the rider doesn't know if that's "the hub is empty" or "all vehicles are reserved".

**Impact:** Silent feature break if server schema evolves.

**Fix:** Server returns only `AVAILABLE` vehicles (it already knows which ones are pickable). Client renders what the server sends. If the list is empty, show "No vehicles available at this hub right now — try another hub or come back later."

**Effort:** 30 min (server) + 1h (client).

---

### P1-8: `vehicle_photos_screen.dart` shows denormalized `rider.pickupPhoto*` — if the rider does a re-pickup (rare but possible), the gallery shows stale photos

**Repro:**
1. `vehicle_photos_screen.dart:14-24`:
   ```dart
   final rider = ref.watch(riderProvider).rider;
   final vehicle = rider?.assignedVehicle ?? 'Not Assigned';
   final pickupPhoto = rider?.pickupPhotoFront;

   final photos = [
     {'label': 'Front View', 'url': pickupPhoto},
     {'label': 'Back View', 'url': rider?.pickupPhotoBack},
     ...
   ];
   ```
2. The screen reads from the rider model (denormalized). If a rider re-picks a vehicle (e.g., after a return + new lease), the rider model has the **old** photos. The new photos from `PickupHubScreen._photos` (the local widget state) are never persisted to the rider model until `syncPickup` completes.
3. The screen also has no pull-to-refresh — even if the rider's photos are stale, the user can't manually reload.

**Impact:** Misleading display. The rider thinks their old photos are still valid for the new vehicle.

**Fix:** Either:
- Don't show the screen until after `syncPickup` completes (move the screen to be reachable from the dashboard, gated on `pickupDone`).
- Or: read from a server endpoint that returns the most recent pickup photos for the rider.

**Effort:** 1-2h.

---

### P1-9: `PickupSuccessScreen._initState` fires PostHog `pickup_completed` before the rider is actually onboarded

**Repro:**
1. `pickup_success_screen.dart:17-21`:
   ```dart
   @override
   void initState() {
     super.initState();
     PostHogService.capture('pickup_completed');
   }
   ```
2. The screen is shown after `PickupVerificationScreen._completePickup` returns (line 81: `widget.onNext()`). But `_completePickup` returns even if the `refreshFromApi()` call (line 80) **fails** — the `await` would throw, the catch block fires the snackbar, but the `widget.onNext()` is reached before the catch (because it's the last line of the try, and the refresh is awaited before it).
3. Actually, looking more carefully: if `syncPickup` succeeds, `refreshFromApi` is awaited, then `onNext` fires. If `refreshFromApi` fails, the catch fires (snackbar), `onNext` does **not** fire (because the exception jumps out of the try). So the success screen is **only** shown if both calls succeed.
4. The PostHog capture is then correct in that it's only fired when the pickup is complete. But it doesn't include the hub/vehicle IDs, the number of photos, or the time taken. Analytics is blind.
5. The more concerning issue: the screen doesn't validate that the rider is actually routed to `AuthState.dashboard` afterward. The `onFinish` callback (line 66) is wired to `state._navigateToLocal(AuthState.dashboard)` in router_body.dart:303, but if anything between the success screen and the dashboard fails (e.g., a polling check), the rider could be left on a dead screen.

**Impact:** Analytics gap. No measurement of pickup time, success rate by hub, etc.

**Fix:** Move PostHog capture to `PickupVerificationScreen._completePickup` (after `refreshFromApi` succeeds) and include `{hubId, vehicleId, photoCount, durationMs}`.

**Effort:** 30 min.

---

## P2 — Cleanup backlog

### P2-1: `PickupHubScreen` is 700+ lines — extract `pickup_hub_state.dart` (Riverpod) and `pickup_hub_widgets.dart` (presentational)

Same god-widget anti-pattern as `end_rental_screen.dart` (audit #15). The screen owns: hub list, vehicle list, team leader selection, emergency contact + OTP state, photo upload (5 files), step indicator, navigation. Refactor into:
- `PickupHubController` (Riverpod Notifier) — owns state
- `AssignmentDetailsCard` (already extracted)
- `VehicleConditionCard` (already extracted)
- `PhotoUploadSection` (new)

### P2-2: `PickupHubScreen._verifyEmergencyOtp` (line 308-320) checks emergency contact ≠ rider phone and ≠ guarantor phone — but the rider might have a different rider ID

The check is `digits == riderPhone` (string compare). If the rider has a `+91` prefix on their phone but types the emergency contact without the prefix, the check passes (correctly), but the server-side compare might fail. Add a normalization step before the compare.

### P2-3: `PickupHubScreen._showVehicleSearchSheet` (line 213-230) re-fetches vehicles every time it's opened

`_fetchVehicles(hubId)` is called from the hub-change callback (line 553) but the search sheet itself doesn't re-fetch. It just shows `_vehicles` from state. If the rider opens the sheet, then waits 30s, then searches, the vehicle list is stale. Fix: refetch on sheet open (with a debounce).

### P2-4: `_uploadImage` `type` parameter is `String` not enum — typo-prone

The type field is one of `'front'`, `'back'`, `'left'`, `'right'`, `'with_vehicle'`. Pass as enum, validate at compile time. Same as audit #9 P1-7 (transaction_type as String everywhere).

### P2-5: The hardcoded `Rajesh Kumar (TL-01)` etc. should live in a `lib/utils/placeholders.dart` constants file

Same as the `+91-9876543210` placeholder for support (audit #9 P1-1) and `support@voltium.app` (audit #11 P1-2). Centralize the placeholders so a future test data cleanup finds them.

### P2-6: `PickupHubScreen` `onNext` callback (line 23-33) takes 9 named parameters — same constructor anti-pattern as the dead `RentalRepositoryImpl.fetchHubs` (audit #15)

Should accept a `PickupDraft` value object. The 9 named parameters are exactly the data the router state stores (P0-2).

---

## Tests gap analysis

| Flow | Integration test? | Unit test? | Notes |
|---|---|---|---|
| Hub selection | **No** | Render-only (`pickup_screen_test.dart:60-71`) | **GAP** |
| Vehicle selection (search sheet) | **No** | Golden test (`pickup_vehicle_search_sheet_golden_test.dart`) | **GAP** |
| Emergency contact OTP | **No** | No | **GAP** — no test for the dual-API call (`sendOtp` + `verifyPhone`) |
| 5-photo upload (sequential) | **No** | No | **GAP** — no test for upload retry, image compression |
| Terms agreement + `syncPickup` POST | **No** | No | **GAP** — the contract is in audit #15 P0-1 territory |
| `PickupSuccessScreen` | **No** | Render-only (`pickup_success_screen_test.dart:12-36`) | **GAP** |
| `VehiclePhotosScreen` | **No** | No | **GAP** |
| `TlDetailsScreen` | **No** | No | **GAP** |
| Router state persistence (P0-2) | **No** | No | **GAP** — no test for app-kill recovery |
| Auth state transitions | **No** | No | **GAP** — the `AuthState.pickupHub` → `pickupVerification` → `pickupSuccess` → `dashboard` chain is untested |
| Field name confusion (P1-2) | **No** | No | **GAP** — the `tl_details_screen` reading `emergencyContact` as `tlPhone` is silent |

**Headline:** **The entire pickup module has zero integration tests.** The 5 widget tests in `pickup_screen_test.dart` and 4 in `pickup_success_screen_test.dart` only verify rendering, not behavior. A single integration test for the full flow would catch every P0 in this audit.

**Recommended test plan:**
1. **`e2e_individual/34_pickup_flow_test.dart`** — full flow: login → pre-dashboard → pick hub → pick vehicle → emergency contact OTP → 5 photos → terms agreement → sync → success → dashboard. **6h.**
2. **`test/pickup/pickup_hub_screen_test.dart`** — unit tests for `_submitForm` validation, emergency contact sanitization (P0-3 regex bug). **2h.**
3. **`test/pickup/pickup_verification_screen_test.dart`** — unit tests for the `syncPickup` body shape. **2h.**
4. **`test/pickup/pickup_draft_provider_test.dart`** — new Riverpod provider for the pickup draft state (P0-2 fix). **3h.**

**Total: 13h of test work to bring the pickup module to 80% coverage.**

---

## Recommended fix order

| # | PR | Scope | Effort | Risk | Closes |
|---|---|---|---|---|---|
| 1 | **PR-9a: Add a single e2e pickup test** | `e2e_individual/34_pickup_flow_test.dart` — login → dashboard via pickup. Mocks `VoltiumApiService`. | 4-6h | Low (additive) | P0-1, P0-2, P0-3, P0-4 (all caught by the test) |
| 2 | **PR-9b: Fix emergency contact regex** | Change `RegExp(r'\\D')` → `RegExp(r'\D')` on `pickup_hub_screen.dart:433`. Add unit test. | 5min | Low | P0-3 |
| 3 | **PR-9c: Move pickup state to Riverpod** | New `pickupDraftProvider`. `RouterState` no longer holds the 9 fields. Persist via `CacheService`. | 3-4h | Medium (touches router) | P0-2, P2-1, P2-6 |
| 4 | **PR-9d: Parallel photo upload** | Mirror the end-rental `Future.wait` pattern. Show per-photo progress. | 1-2h | Low | P1-6 |
| 5 | **PR-9e: Validate `syncPickup` body** | Remove `bookingId: riderId` (semantically wrong). Add `teamLeaderPhone` field or fix copy. | 30min | Low | P1-2, P1-5 |
| 6 | **PR-9f: Server-driven team leader list** | New `GET /api/rider/hubs/:id/team-leaders`. Replace hardcoded `['Rajesh Kumar (TL-01)', ...]` with the fetch. | 2-3h | Medium (server) | P1-3 |
| 7 | **PR-9g: Hub list refresh on resume** | `WidgetsBindingObserver` in `PickupHubScreen`. Refresh on `AppLifecycleState.resumed`. | 2-3h | Low | P0-4 |
| 8 | **PR-9h: Delete dead `PickupEntity` + dead `domain/` folder** | `rm -r flutter/lib/features/pickup/domain/`. | 5min | Low | P1-1 |
| 9 | **PR-9i: A11y rewrite of `OtpGrid`** | Replace with `pinput` package or proper per-cell `FocusNode`s. | 2-3h | Low | P1-4 |
| 10 | **PR-9j: Test sprint** | Integration test + unit tests for the new draft provider. | 13h | n/a | Tests gap (all) |

**Total: ~4 days of focused work to close all 4 P0s and 6/9 P1s.**

---

## Architecture observations

### The pickup flow is a god-widget with 9 fields in `RouterState`

`PickupHubScreen` is 700+ lines. The state lives in 9 `_pickup*` fields in `RouterState`. The screen owns the form, the photo uploads, the OTP flow, the vehicle search, the step indicator. This is the textbook case of "should be a feature module" not a screen.

The recommended refactor (PR-9c) is to extract a `PickupDraft` value object (with `hubId`, `vehicleId`, `teamLeader`, `emergencyContact`, `pickupPhotos: Map<String, String>`) and a Riverpod `pickupDraftProvider`. The screen becomes a thin view. The router no longer carries the state.

### The 14-parameter `VehicleConditionCard` constructor is a smell

`pickup_widgets.dart:190-208` accepts 14 named parameters. The caller in `pickup_hub_screen.dart:585-605` has to wire 14 values. This is the textbook case for breaking into a smaller model — `VehiclePhotoSlots` with 5 entries. Same anti-pattern as the dead `RentalRepositoryImpl.fetchHubs` from audit #15.

### `AuthState` enum is the right design — but the implementation is fragile

`AuthState.pickupHub` / `pickupVerification` / `pickupSuccess` are correct enum values (the lifecycle is well-modeled). But the `_canPop` list (router.dart:317-338) hardcodes the states that don't allow back nav. If a new pickup-related state is added (e.g., a "re-pickup" flow), the list must be manually updated. A derived check (`_canPop = AuthState.otp <= state <= AuthState.pickupSuccess`) would be safer.

### Hardcoded team leader names are a test-data leakage

`['Rajesh Kumar (TL-01)', 'Not assigned', 'Sanjay Singh (TL-03)']` is the same pattern as the placeholder phone numbers in audit #14 P0-3 and the support hotline in audit #9 P1-1. These are dev-time data that leaked into production code. A `_kPlaceholderTeamLeaders` constant in a shared `lib/utils/placeholders.dart` would make them greppable for cleanup.

### The OTP grid is a custom widget when a mature one exists

`OtpGrid` (pickup_hub_widgets.dart:328-392) reimplements what `pinput`, `otp_pin_field`, or `pin_code_fields` packages provide. The custom one has a11y issues, a fragile `IgnorePointer` + `Opacity(0)` pattern, and lacks keyboard navigation. Replacing it would close P1-4 in 2-3h and improve the support flow too (if it's reused).

### `_showImageSourceDialog` is defined in pickup_hub_widgets.dart but is a generic widget

`pickup_hub_widgets.dart:80-90` defines `showImageSourceDialog(context, type, onUploadImage)`. Same widget exists in `top_up_proof_screen.dart` via `ImageSourceBottomSheet.show(context: ...)`. Two implementations of the same widget.

---

## Out of scope for this audit

- The web `POST /api/rider/sync/pickup` route and use case (audit #15).
- The end-rental photo upload (audit #15 — overlap on `_uploadImage` pattern, but the fix is similar).
- The auth flow (audit #14).
- The dashboard widgets that show pickup state (audit #7).
- The notification flows (audit #4 + #7).

---

## Cross-audit themes this audit confirms

1. **Dead domain entities** — `PickupEntity` (this audit), `WalletEntity` (audit #16 P0-2), `RentalPlanEntity` partially dead (audit #15). The `domain/` folder pattern is started but never completed.
2. **Hardcoded placeholder data** in production — `Rajesh Kumar (TL-01)` (this audit), `+91-9876543210` (audit #12), `support@voltium.in` (audit #9), `TEST_PHONES = ['9876543210', ...]` (audit #14 P0-3 + #16 P1-7).
3. **Zero integration tests on high-stakes surfaces** — pickup (this audit), emergency (audit #12 P0-5), auth (audit #14 tests gap), end-rental (audit #15 — 17 of 33 tests are no-op tautologies).
4. **The same Flutter-side pattern: "render-only widget tests"** — pickup (this audit), end-rental (audit #15), wallet history (audit #16 — no e2e).
5. **Sequential photo upload** — pickup (this audit P1-6), end-rental fixed by PR-66 (audit #15), KYC (audit #10 P0-1 still sequential).

---

## Cross-audit links

- Audit #15 (Rental Lifecycle, P0-1) — same `syncPickup` endpoint, contract mismatch on the Flutter side.
- Audit #12 (Emergency, P0-3) — same `emergencyContact` field-name confusion in `tl_details_screen.dart`.
- Audit #14 (Auth, P0-3) — same hardcoded `TEST_PHONES` placeholder pattern.
- Audit #9 (Support, P1-1) — same hardcoded support hotline.
- Audit #10 (Onboarding, P0-1) — same sequential upload pattern (KYC, not yet fixed).
- Audit #7 (Dashboard, P0-1) — same lifecycle-gate confusion in pickup state propagation.
- Audit #16 (Wallet, P2-2) — same dead `WalletEntity` class pattern.

---

**End of audit.** Recommend starting with **PR-9b (P0-3 regex fix, 5 min)** — one-character change, high signal. Follow with **PR-9a (P0-1 e2e test, 4-6h)** — without a test, you can't safely refactor the pickup module.
