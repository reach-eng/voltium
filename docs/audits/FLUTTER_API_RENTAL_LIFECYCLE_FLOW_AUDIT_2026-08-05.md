# Rider App Flows — Flutter → API — Rental Lifecycle — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** the full rental lifecycle end-to-end (Flutter client → Next.js API):

| Flow | Web route | Flutter caller | Auth contract file |
|---|---|---|---|
| Browse plans | `GET /api/rider/plans` | `VoltiumApiService.fetchPlans` → `VoltiumApiClient.getRiderPlans` | `web/src/app/api/rider/plans/route.ts` |
| Subscribe / change plan | `POST /api/rider/plans` | `VoltiumApiService.subscribePlan` → `VoltiumApiClient.postRiderPlans` (called by `ChoosePlanScreen._subscribe`) | same |
| Browse hubs | `GET /api/rider/hubs` | `VoltiumApiService.fetchHubs` → `VoltiumApiClient.getRiderHubs` (called by `PickupHubScreen._fetchHubs`) | `web/src/app/api/rider/hubs/route.ts` |
| Vehicles at hub | `GET /api/vehicles?hubId=` | `VoltiumApiService.fetchVehicles` → `VoltiumApiClient.getVehicles` (called by `PickupHubScreen._fetchVehicles`) | `web/src/app/api/vehicles/route.ts` |
| Dynamic pricing | `GET /api/rider/pricing?hubId=` | **No Flutter caller** | `web/src/app/api/rider/pricing/route.ts` |
| Book rental | `POST /api/rental/book` | **No Flutter caller** — `postRentalBook` exists in generated client but is dead code. Riders never book this way; pickup is the entry point. | `web/src/app/api/rental/book/route.ts` |
| Pickup verification | `POST /api/rider/sync/pickup` | `VoltiumApiService.syncPickup` (called by `PickupHubScreen._submitForm` → `RiderProvider`) | `web/src/app/api/rider/sync/pickup/route.ts` (via `rentalUseCases.syncPickup`) |
| End / return rental | `POST /api/rider/rental/return` | `VoltiumApiService.submitVehicleReturn` → `VoltiumApiClient.postRiderRentalReturn` (called by `EndRentalScreen._handleReturn`) | `web/src/app/api/rider/rental/return/route.ts` |

**Files read in full:**
- `web/src/app/api/rider/hubs/route.ts` (20 lines — list active hubs, no auth)
- `web/src/app/api/rider/plans/route.ts` (57 lines — GET list, POST subscribe; `subscribePlanSchema` is `planId`-only)
- `web/src/app/api/rider/pricing/route.ts` (70 lines — hardcoded 3 plans, dynamic price per hub)
- `web/src/app/api/rider/rental/return/route.ts` (77 lines — `.strict()` Zod schema, accepts `returnPhotos[]` OR `photoLeft/Right/Front/Speedometer`)
- `web/src/app/api/rental/book/route.ts` (65 lines — book rental, dynamic pricing inside the use case)
- `web/src/app/api/vehicles/route.ts` (28 lines — `getOrSetResponse`-cached vehicle list at a hub)
- `web/src/server/modules/rentals/rental.use-cases.ts` (293 lines — `getPlans`, `bookRental`, `syncPickup`, `startRental`, `requestReturn`)
- `web/src/server/modules/rentals/rental.schemas.ts` (24 lines — `endRentalSchema` is **dead code**, never imported)
- `web/src/server/modules/rentals/use-cases/submitReturn.ts` (171 lines — `submitReturn` use case, requires ≥4 photos, atomic VehicleReturn + lifecycleStatus→RETURN_PENDING)
- `web/src/server/modules/rentals/use-cases/book-rental.use-case.ts` (12 lines — facade re-exporting `bookRental`/`syncPickup`/`submitReturn`)
- `web/src/server/modules/rentals/use-cases/errors.ts` (23 lines — `RentalBookError`, `RentalReturnError`, `RentalNotFoundError`)
- `web/src/lib/validators.ts` (line 358-362 — `subscribePlanSchema` is `planId`-only, no `hubId`/`securityDeposit`/`advanceRentPaid`)
- `flutter/lib/core/network/api_client.dart` (full — 543 lines — `ApiClient` with retry, 401 refresh, `clearAll` on token rejection)
- `flutter/lib/core/network/generated/api_client.dart` (selected — `postRentalBook` line 92, `getRiderPlans` 389, `getRiderPricing` 402, `postRiderSyncPickup` 440, `getRiderHubs` 551, `postRiderRentalReturn` 557, `getVehicles` 238, `getAdminHubs` 248)
- `flutter/lib/core/network/generated/api_models.dart` (line 777-820 — `BookRentalRequest`/`BookRentalResponse`; line 2733-2759 — `VehicleReturnRequest` with `riderId`/`photoUrls`/`reason`)
- `flutter/lib/services/voltium_api_service.dart` (full — 240 lines — singleton service with `fetchHubs`, `fetchVehicles`, `fetchPlans`, `subscribePlan`, `syncPickup`, `submitVehicleReturn`, `uploadFile`, `get/post` passthroughs)
- `flutter/lib/features/rentals/data/repository_impl.dart` (60 lines — `RentalRepositoryImpl`, **never called by any UI**; 4/5 methods are dead)
- `flutter/lib/features/rentals/domain/repository.dart` (28 lines — abstract interface)
- `flutter/lib/features/rentals/domain/entity.dart` (84 lines — `RentalPlanEntity`, `ActiveRentalEntity`)
- `flutter/lib/features/rentals/presentation/screens/end_rental_screen.dart` (full — 776 lines — parallel photo upload, 4-photo gate, `onSuccess` callback)
- `flutter/lib/features/rentals/presentation/screens/choose_plan_screen.dart` (lines 1-456 — plan cards, subscribe, `_subscribe` → `subscribePlan`)
- `flutter/lib/features/rentals/presentation/screens/rental_details_screen.dart` (full — 318 lines — read-only summary, dead `EndRental` button)
- `flutter/lib/features/pickup/presentation/screens/pickup_hub_screen.dart` (lines 1-591 — hub dropdown, vehicle search, 5-photo upload, OTP verify for emergency contact)
- `flutter/lib/core/state/rider_provider.dart` (lines 270-301 — `logout()` + `submitVehicleReturn()` with empty strings + param swap)

**Out of scope:** Auth (covered in `FLUTTER_API_AUTH_FLOW_AUDIT_2026-08-05.md`). Rent-reminder cron (`workers/index.ts` `rent-due-emitter` line 204). The admin-side vehicle-return review (covered in `ADMIN_FINANCE_AUDIT_2026-08-05.md`). Wallet top-up for deposit (separate audit). The auto-debit logic that decrements wallet when rent falls due (separate audit).

---

## TL;DR

**The rental lifecycle has 4 P0 bugs. The headline: every end-rental request the app sends is rejected by the server with 400 "Invalid fields in request body" — the body shape Flutter sends (`{riderId, photoUrls, reason}`) does not match the server's `.strict()` schema (`{returnPhotos[] | photoLeft/Right/Front/Speedometer, reason?, latitude?, longitude?}`).** The optimistic local "Request Submitted!" screen is reached only when an exception fires, never on a 2xx — and because the API 400s, the user gets the error snackbar, not the success screen. The rider cannot end their rental through the app. The deposit refund, vehicle return review, and `lifecycleStatus → RETURN_PENDING` transition are all blocked behind this.

The other 3 P0s are all "the wrong endpoint is wired" class bugs that look like dead code but bite the moment anyone re-enables the call:
1. **`RentalRepositoryImpl.fetchHubs()` calls `getAdminHubs()` (admin-auth required) instead of `getRiderHubs()` (rider-public).** Currently masked because the UI bypasses the repository and goes through `VoltiumApiService.fetchHubs()` which does the right thing — but the repository method is a trap.
2. **`RiderProvider.submitVehicleReturn(photos, reason)` (line 279-301) passes `vehicleId: ''` and `hubId: ''`** (empty strings) and `RentalRepositoryImpl.submitVehicleReturn(vehicleId, hubId, photos)` then does `riderId: vehicleId` (param swap), discarding `hubId`. The path is dead because the screen bypasses it, but if it's ever wired back, **the rider's vehicleId would be sent as the riderId in the VehicleReturn row** and the request would 400.
3. **`RentalRepositoryImpl` is **entirely dead code**.** 4 of its 5 methods are never called by any Flutter UI (`fetchHubs`, `fetchVehicles`, `subscribePlan`, `submitVehicleReturn` are all bypassed in favor of `VoltiumApiService` singleton). Only `subscribePlan` has a single caller via `VoltiumApiService.subscribePlan`, but even that uses the service directly. The repository contract is a maintainability hazard — the next developer to add a new screen will pick the repository (correct) or the service (wrong) based on guesswork, not convention.

There are also contract-drift P1s: the `subscribePlanSchema` doesn't include the `hubId`/`securityDeposit`/`advanceRentPaid` fields the Flutter `subscribePlan` sends (server is lenient — `z.object({planId})` accepts extra fields — so this works today, but it's a footgun), `endRentalSchema` in `rental.schemas.ts` is **dead code** (a parallel `returnSchema` lives inline in the route file), and `getRiderPricing()` exists in the generated client but has no UI caller.

The "Charges deposit" column in the routing table is **wrong** — `bookRental` does NOT charge a deposit. The deposit is charged at `POST /api/rider/plans` (`planUseCases.subscribeToPlan` → `WalletService`). `bookRental` only creates the `RentalLease` row and reserves the vehicle.

There are **4 P0s**, **7 P1s**, and **4 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, security gap, silent data loss, business logic bug | Before next release |
| **P1** | UX friction, race condition, accessibility, dead code, contract drift | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: `EndRentalScreen` sends `{riderId, photoUrls, reason}`; server `.strict()` schema rejects both `riderId` and `photoUrls` → every return request 400s

**Repro:**
1. Rider completes a rental, taps "End Rental" in `rental_details_screen.dart:243-249`.
2. Captures 4 photos, taps "Confirm Return" in `end_rental_screen.dart:680`.
3. `EndRentalScreen._handleReturn` (line 134-208) uploads 4 photos in parallel, then calls `VoltiumApiService().submitVehicleReturn(riderId: riderId, photoUrls: photoUrls, reason: ...)` (line 180-184).
4. `VoltiumApiService.submitVehicleReturn` (line 172-184) builds `gen.VehicleReturnRequest(riderId: riderId, photoUrls: photoUrls, reason: reason)` — `gen.VehicleReturnRequest` is the model in `flutter/lib/core/network/generated/api_models.dart:2733-2759` and serializes to `{riderId, photoUrls, reason}`.
5. Sends `POST /api/rider/rental/return` with that body.
6. Server `web/src/app/api/rider/rental/return/route.ts:9-20` parses with `.strict()` Zod schema:
   ```ts
   z.object({
     latitude: z.number().optional(),
     longitude: z.number().optional(),
     reason: z.string().optional(),
     returnPhotos: z.array(z.string()).optional(),
     photoLeft: z.string().optional(),
     photoRight: z.string().optional(),
     photoFront: z.string().optional(),
     photoSpeedometer: z.string().optional(),
   }).strict();
   ```
7. `riderId` and `photoUrls` are **unknown fields** — Zod returns `{ success: false }`. Route returns 400 with `"Invalid fields in request body"` (line 36).
8. `ApiClient._handleResponse` (api_client.dart:501-530) throws `ApiException(message: 'Invalid fields in request body', statusCode: 400)`.
9. `EndRentalScreen._handleReturn` catch block (line 197-207) shows snackbar `"Error submitting return. Please try again."` and resets `_submitting = false`. The optimistic success screen is never reached.

**Impact:** **Every end-rental request fails with a generic error.** The rider's deposit refund, vehicle return review queue, and lifecycle transition (`ACTIVE → RETURN_PENDING`) all never fire. The rider is stuck in `ACTIVE` state, cannot pick up a new vehicle (the `syncPickup` use case requires `lifecycleStatus: { in: ['PLAN_SELECTED', 'DEPOSIT_APPROVED'] }` per `rental.use-cases.ts:139` — though this is the wrong check, the *bookRental* use case checks `PLAN_SELECTED` or `DEPOSIT_APPROVED`, so the rider can still book a new lease). The vehicle they're returning remains `ACTIVE_RENTAL`, blocking any re-assignment.

This is a P0 because it's a **fully broken core feature**. The screenshots from `audit #8 P0-1` show the success screen never appears; the user is stranded.

**Fix:** Two parts.
1. **Regenerate the Flutter client** to match the server schema. The generated `VehicleReturnRequest` (api_models.dart:2733) should be `{returnPhotos: List<String>, reason?: String, latitude?: double, longitude?: double}` and `submitReturn` should ignore the rider ID (it's taken from the session, not the body — see `submitReturn.ts:58-60`).
2. **Update `VoltiumApiService.submitVehicleReturn`** to call with the right shape: `submitReturn(photoUrls: photos, reason: ..., latitude: ..., longitude: ...)`. Photo order: `submitReturn.ts:37` comment says `[photoLeft, photoRight, photoFront, photoSpeedometer]` — so the Flutter `_photos` map keys must be re-ordered to that sequence before passing (currently they're keyed `'left' | 'right' | 'front' | 'speedometer'` in `_handleReturn` line 29-34, which matches — good).
3. **Add a debug-only** `assert(returned != null, 'Server should echo returnId')` to surface silent 2xx-with-empty-body bugs.
4. **Add an integration test** that exercises the full upload → return flow against a real server and asserts 200.

**Effort:** 30 min to fix the Flutter code + 1h to write the integration test that catches this. 2h total.

---

### P0-2: `RentalRepositoryImpl.fetchHubs()` calls `getAdminHubs()` (admin auth) instead of `getRiderHubs()` (public)

**Repro:**
1. If a future screen is built to use `RentalRepository.fetchHubs()` (the canonical interface), it hits `getAdminHubs()` per `repository_impl.dart:13`.
2. `getAdminHubs()` (`api_client.dart:248`) calls `GET /api/admin/hubs`.
3. That route (`web/src/app/api/admin/hubs/route.ts`) requires admin session cookie + role check.
4. A rider's `Authorization: Bearer <rider-token>` is rejected with 401/403.

**Impact:** Currently latent — the live `PickupHubScreen._fetchHubs` uses `VoltiumApiService.fetchHubs()` → `getRiderHubs()` → `/api/rider/hubs` (correct). The repository method is **dead code** today. But the repository is the *only* abstract contract in `features/rentals/domain/repository.dart` — it's the entry point the architecture encourages. The next dev to add a hub selector widget will:
- See `RentalRepository` in `domain/`
- Wire it through Riverpod
- Call `fetchHubs()`
- Get a 401 in production
- Spend 2h debugging

The audit is forced to flag it now because the **type signature is `Future<Map<String, dynamic>>`** — the error doesn't surface until runtime.

**Fix:** Change `repository_impl.dart:13` from `_apiClient.getAdminHubs()` to `_apiClient.getRiderHubs()`. Add a unit test `test/features/rentals/data/repository_impl_test.dart` (already exists per the grep) that mocks the client and asserts the right call. Also: add a lint rule that disallows calling admin-suffixed methods from `features/rentals/*`.

**Effort:** 5 min for the fix, 30 min for the test, 1h for the lint rule.

---

### P0-3: `RiderProvider.submitVehicleReturn(photos, reason)` passes empty `vehicleId=''` and `hubId=''`; `RentalRepositoryImpl.submitVehicleReturn` swaps `vehicleId`→`riderId` and discards `hubId`

**Repro:** (Same dead-code path as P0-2 but worse — it's a data corruption bug if ever wired.)
1. `RiderProvider.submitVehicleReturn(photos, reason)` at `rider_provider.dart:279-301`:
   ```dart
   await _rentalRepository.submitVehicleReturn(
     vehicleId: '',
     hubId: '',
     photos: photoUrls,
     reason: reason,
   );
   ```
2. `RentalRepositoryImpl.submitVehicleReturn(vehicleId, hubId, photos)` at `repository_impl.dart:49-60`:
   ```dart
   return VoltiumApiService().submitVehicleReturn(
     riderId: vehicleId,  // ← BUG: vehicleId is passed AS riderId
     photoUrls: photos,   // ← would be ignored by server schema (see P0-1)
   );
   ```
3. If this path is ever wired (e.g., a future maintainer "consolidates" the two return code paths), the rider's **vehicleId** gets persisted as the **riderId** on the `VehicleReturn` row (and `riderId: ''` in the row, which is a non-nullable string → Prisma will throw at insert time). Plus `hubId` is lost.

**Impact:** Currently dead — the screen calls `VoltiumApiService` directly. But the dead-code-with-typo is a maintenance landmine. The next time someone tries to "make the repository the single source of truth for rental API calls" they'll reintroduce a real bug.

**Fix:** 
- **Delete `RiderProvider.submitVehicleReturn`** (line 279-301) entirely — it's unused.
- **Delete `RentalRepositoryImpl.submitVehicleReturn`** (line 49-60) — it's a duplicate of the service method and broken.
- Add a `// DO NOT ADD METHODS HERE: see VoltiumApiService` comment on the `RentalRepository` interface explaining the current architecture (one-day decision: consolidate everything to the service until a real DI framework like Riverpod providers is wired in).

**Effort:** 15 min.

---

### P0-4: `EndRentalScreen` reaches success via optimistic local state, never on a confirmed server 2xx

**Repro:** (Read `end_rental_screen.dart:180-196`.)
```dart
await api.submitVehicleReturn(...);
PostHogService.capture('rental_ended', ...);  // ← fires even on 400
if (mounted) {
  setState(() {
    _submitting = false;
    _submitted = true;  // ← success state set after the await
  });
  await Future.delayed(const Duration(seconds: 2));
  if (mounted) widget.onSuccess?.call();
}
```

The success state IS gated on the `await` — if the server throws (which it always does per P0-1), the `setState` is never reached, the catch block runs instead, and the error snackbar fires. **So in practice, the success screen is currently unreachable**, and the error is shown. That's a *correct* failure mode (not silently succeeding). But two problems remain:

1. **PostHog `rental_ended` fires before checking the response is actually success.** If `submitVehicleReturn` ever changed to not throw on error, we'd capture success analytics on a 400. Better: only capture after the `await` completes without exception.
2. **`widget.onSuccess?.call()` is never wired from `rental_details_screen.dart`.** At line 247 the screen is launched via `MaterialPageRoute(builder: (_) => const EndRentalScreen())` — no `onSuccess` passed. Even if the return flow worked end-to-end, the rider would stay on the success screen for 2s, then be returned to the rental details screen (which still shows `rentalStatus: 'ACTIVE'` because the rider profile isn't refreshed). **Audit #8 P0-1 already flagged this.**

**Impact:** This combines with P0-1 to mean the rider sees the "Error submitting return" snackbar every time, then is stuck on the end-rental screen (no navigation back). They have to use the back arrow to return to rental details, where the rental still shows ACTIVE.

**Fix:**
- After the 2-second success delay, **call `ref.read(riderProvider.notifier).refreshFromApi()`** to pull the fresh `lifecycleStatus: 'RETURN_PENDING'` and updated vehicle info, then `Navigator.pop(context, true)`.
- In `rental_details_screen.dart:243-250`, pass `onSuccess: () { Navigator.pop(context); ScaffoldMessenger.showSnackBar('Return request submitted'); }`.
- **Move `PostHogService.capture` into the success branch only.**

**Effort:** 1h (fix + add `refreshFromApi` call + integration test).

---

## P1 — Should fix this sprint

### P1-1: `subscribePlan` sends `hubId, securityDeposit, advanceRentPaid`; `subscribePlanSchema` accepts only `planId` (server tolerates extra fields today, but a future `.strict()` would break silently)

**Repro:**
1. `ChoosePlanScreen._subscribe` (`choose_plan_screen.dart:110-115`) calls `VoltiumApiService().subscribePlan(hubId: hubId, planId: ..., securityDeposit: ..., advanceRentPaid: ...)`.
2. `VoltiumApiService.subscribePlan` (line 110-122) sends body `{hubId, planId, securityDeposit, advanceRentPaid}` via `postRiderPlans`.
3. Web `subscribePlanSchema` (`validators.ts:358-361`) is `z.object({ planId: z.string().min(1) })` — **no `hubId`, no `securityDeposit`, no `advanceRentPaid`**.
4. Zod's default `z.object()` is **non-strict** — unknown fields are silently dropped. Server works today.
5. **Risk:** If anyone adds `.strict()` to `subscribePlanSchema` (a reasonable refactor to catch bugs like this one), `postRiderPlans` will start 400ing on every subscription. The security deposit accounting lives client-side, so a missing `securityDeposit` field could be silently lost without a server error.

**Impact:** The deposit calculation and rent-due generation rely on the **subscription** event, not on what the client sends. So `securityDeposit` and `advanceRentPaid` are pure client hints that the server ignores. The rider may think they're paying an advance and get nothing.

**Fix:**
- **Decide on a contract.** Either: (a) server reads `securityDeposit` from a `WalletService` ledger event and client should stop sending it, or (b) server actually charges the deposit and the schema must be updated.
- For now, the safest fix is: **add `hubId` and `securityDeposit` to `subscribePlanSchema`** (since the deposit is conceptually attached to a hub+plan), document the contract, and add an integration test that asserts the body shape.
- Also: regenerate the OpenAPI client so the Flutter `postRiderPlans` call takes a typed `SubscribePlanRequest` rather than `Map<String, dynamic>`.

**Effort:** 2h (schema + regen + tests + Flutter call-site fix).

---

### P1-2: `rental.schemas.ts:17-21` `endRentalSchema` is dead code; the live schema is inlined in the route

**Repro:**
1. `web/src/server/modules/rentals/rental.schemas.ts:17-21` defines:
   ```ts
   export const endRentalSchema = z.object({
     riderId: z.string().min(1),
     returnPhotos: z.array(z.string().url()).min(1, 'At least one return photo required'),
     returnReason: z.string().min(5).max(500),
   });
   ```
2. `grep` for `endRentalSchema` in `web/src` returns 0 importers.
3. The live `web/src/app/api/rider/rental/return/route.ts:9-20` defines an **incompatible** `returnSchema` with `.strict()` and the four named fields.

**Impact:** Two parallel schemas for the same endpoint. If someone refactors the route to import `endRentalSchema` "for consistency", the route will accept a body shape no Flutter client sends (Flutter sends `riderId` + `photoUrls`, not `returnPhotos[]` + `returnReason`). End-rental breaks.

**Fix:**
- **Delete `endRentalSchema`** from `rental.schemas.ts`.
- **Or**, move the live `returnSchema` into `rental.schemas.ts` and import it from the route, with comments explaining the `.strict()` requirement and the photo order.
- **Regenerate the OpenAPI spec** from the live route so the generated client matches.

**Effort:** 30 min.

---

### P1-3: `getRiderPricing()` exists in the generated client but has no UI caller

**Repro:**
1. `web/src/app/api/rider/pricing/route.ts:14` returns dynamic per-hub pricing for the 3 hardcoded plans.
2. `flutter/lib/core/network/generated/api_client.dart:402` has `getRiderPricing()`.
3. `grep` for `getRiderPricing` in `flutter/lib/**.dart` returns 0 callers.

**Impact:** The endpoint exists, the server has the logic, the client knows about it, **but no screen shows the dynamic price to the rider**. The rider sees the static `plan.basePrice` in `ChoosePlanScreen` (e.g., `₹180.00` for Daily Flex) and never learns that the same plan is `₹162` at Hub-A and `₹198` at Hub-B. **Real revenue impact** — the dynamic pricing system is invisible to the user it's designed for.

**Fix:** 
- In `ChoosePlanScreen`, when the rider has a `pickupHub` set, call `getRiderPricing(hubId: pickupHub)` and override the plan price display with `plan.finalPrice`. Show the original price struck-through if `plan.discount > 0`.
- Alternatively, add a small "Hub pricing" panel to `PickupHubScreen` step 1 showing the daily/weekly/monthly price for that hub.

**Effort:** 3-4h (UI + integration test).

---

### P1-4: `RentalRepositoryImpl` is entirely dead code (4/5 methods never called)

**Repro:**
1. `grep` for `RentalRepositoryImpl` in `flutter/lib/**.dart` shows the class is constructed (in `rider_provider.dart`) but the methods are never called from any UI.
2. `flutter/lib/features/rentals/data/repository_impl.dart` defines `fetchHubs`, `fetchVehicles`, `subscribePlan`, `syncPickup`, `submitVehicleReturn`.
3. The screens all use `VoltiumApiService` directly:
   - `PickupHubScreen` → `VoltiumApiService().fetchHubs()` / `fetchVehicles()` / `uploadFile()` / `syncPickup()`
   - `ChoosePlanScreen` → `VoltiumApiService().fetchPlans()` / `subscribePlan()`
   - `EndRentalScreen` → `VoltiumApiService().uploadFile()` / `submitVehicleReturn()`

**Impact:** The "clean architecture" with `domain/repository.dart` is a facade. Any future developer following the pattern will be confused — do I use the repository or the service? There are two ways to do the same thing, both technically working (until P0-2/P0-3 hit). The repository has **one** real consumer in tests (`test/features/rentals/data/repository_impl_test.dart`) where it's mocked against the wrong endpoint (per P0-2).

**Fix:**
- **Option A (preferred):** delete `RentalRepositoryImpl` and `features/rentals/domain/repository.dart`. The `services/voltium_api_service.dart` IS the repository. Rename it to `RentalApiService` and put it under `features/rentals/data/`.
- **Option B:** keep the repository, delete `VoltiumApiService`'s rental methods (`fetchHubs`, `fetchVehicles`, `subscribePlan`, `syncPickup`, `submitVehicleReturn`), and have the service be a thin passthrough. Make the screens call the repository through a Riverpod provider.
- **Option A is correct** — there is no DI framework, no testing benefit to the repository layer, and the service already has the right shape. The pattern was aspirational, never completed.

**Effort:** 2h for option A (delete, rename, fix imports in 4 screens, update 1 test).

---

### P1-5: `ChoosePlanScreen._subscribe` reads `hubId: ''` from `rider.pickupHub`; if rider has no hub, subscription is silent

**Repro:**
1. `choose_plan_screen.dart:106`:
   ```dart
   final hubId = ref.watch(riderProvider).rider?.pickupHub ?? '';
   ```
2. If `pickupHub` is null (e.g., rider re-subscribes after a return but before re-pickup), `hubId = ''` is sent in the body.
3. The server tolerates this (per P1-1) — the subscription succeeds but the `rentalLease.renterHubId` is never set, breaking the `assignedHub` field shown in `rental_details_screen.dart`.
4. **No user-visible error.** The "Plan selected!" success screen appears, the rider's `currentPlan` is updated, but when they next go to pick a vehicle, no hub context is set.

**Impact:** Subtle bug — the rider looks active, dashboard says "Active Plan: Daily Flex", but when they tap "View Rental Details" they see `Pickup Hub: Not Assigned`. They cannot pick a vehicle without manually re-selecting a hub.

**Fix:**
- In `ChoosePlanScreen`, if `hubId.isEmpty`, **redirect to `PickupHubScreen` first** before showing the plan list. Or: at minimum, surface a warning "You haven't selected a pickup hub yet — choose one first" and disable the subscribe button.
- Server-side: add `hubId` to `subscribePlanSchema` as `.min(1)` so the subscription fails fast with a clear error.

**Effort:** 1-2h.

---

### P1-6: `RiderProvider.submitVehicleReturn` (rider_provider.dart:279-301) does sequential `for` photo upload (4×~3s on 3G = 12s) — never re-uses PR-66 parallel upload from `EndRentalScreen`

**Repro:**
1. `RiderProvider.submitVehicleReturn` (rider_provider.dart:286-290):
   ```dart
   for (final photo in photos) {
     final url = await _filesRepository.uploadFile(photo, 'vehicle_return');
     photoUrls.add(url);
   }
   ```
2. PR-66 in `end_rental_screen.dart:154-171` uses `Future.wait` to parallelize.
3. The repository method is dead, but if P0-3 is ever fixed by re-wiring the screen to go through the provider, the parallel upload will be lost.

**Impact:** Same as PR-66 (8-40s → 2-3s on 3G), but conditional on the path being rewired. Currently latent.

**Fix:** Delete the method (per P0-3). If it's kept, mirror the parallel upload from `end_rental_screen.dart:154-171`.

**Effort:** 15 min if kept, 0 min if deleted.

---

### P1-7: `getAdminHubs()` is reachable from a rider token because `ApiClient` only adds `Authorization` header; admin route checks role via cookie separately

**Repro:**
1. `flutter/lib/core/network/generated/api_client.dart:248`:
   ```dart
   Future<ListHubsResponse> getAdminHubs() async {
     final response = await _client.get('/api/admin/hubs');
     return ListHubsResponse.fromJson(response);
   }
   ```
2. The generated client adds the rider's bearer token (per `api_client.dart:87-102`).
3. The web `/api/admin/hubs` route checks the admin session cookie, not the bearer token. The bearer token is ignored.
4. **Result:** 401/403 for the rider. But also: if the rider's bearer token *also* matches an admin session somehow (e.g., dev mode auto-login on the same browser), the rider could see admin data.

**Impact:** Currently P0-2's `fetchHubs` is dead, so the rider never hits this. But the generated client has 9 admin methods (`getAdminHubs`, `getAdminDeposits`, `getAdminAuthMe`, `postAdminAuthLogin`, etc. — see `api_client.dart:148-250`) that are all generated from an OpenAPI spec that exposes admin endpoints to a rider audience. The contract generation has the wrong audience.

**Fix:**
- **Split the OpenAPI spec** into `admin.openapi.ts` and `rider.openapi.ts`. The admin spec is the source of truth for the admin web client; the rider spec is the source of truth for the Flutter client. The current single-spec approach means any admin endpoint added to the spec gets auto-bundled into the rider client.
- Alternative: add a `// RIDER-EXCLUDED` comment marker that the OpenAPI generator script (`scripts/gen-openapi-entries.ts`) honors.

**Effort:** 1 day (split the spec, regenerate, audit which admin methods the rider client should/shouldn't have).

---

## P2 — Cleanup backlog

### P2-1: `choose_plan_screen.dart:106` reads `pickupHub` from `rider.pickupHub` (denormalized string) instead of `rider.pickupHubId` (FK) — fragile after hub rename

`ActiveRentalEntity.pickupHub` is a `String?` (entity.dart:54). If a hub is renamed in admin, every rider's denormalized copy is stale until the rider re-syncs. Use the FK `pickupHubId` for lookups, denormalized name only for display.

### P2-2: `EndRentalScreen._handleReturn` (line 194) `await Future.delayed(const Duration(seconds: 2))` is a magic number

Should be a named constant `kSuccessScreenDuration` or driven by an animation. Also: the `onSuccess` callback runs after the delay but the screen is already at `_submitted = true`, so the callback is fire-and-forget. If the parent has popped, the callback should be no-op safe (it currently is, but undocumented).

### P2-3: `EndRentalScreen` doesn't submit `latitude`/`longitude` even though the server schema accepts them (return/route.ts:11-12)

`submitReturn.ts:39-40` reads `latitude`/`longitude` and persists on the `VehicleReturn` row, but `EndRentalScreen._handleReturn` (end_rental_screen.dart:180-184) only sends `riderId, photoUrls, reason`. **After P0-1 is fixed, the fix should also include passing `latitude`/`longitude`** from `Geolocator.getCurrentPosition()`. This is a P1 for "real" audits — making it P2 here because it's blocked behind P0-1.

### P2-4: `pickup_hub_screen.dart:327-329` instantiates a fresh `ApiClient()` for the emergency-contact OTP send

```dart
final client = ApiClient();
final res = await VoltiumApiClient(client).postAuthSendOtp(...);
```

This works because the `ApiClient()` constructor returns the shared singleton (per `api_client.dart:41-65`). But the inline `VoltiumApiClient(client)` wraps it. The pattern is inconsistent with the rest of the codebase that uses `VoltiumApiService().sendOtp(...)`. **Latent risk:** if `ApiClient` is ever changed to actually be per-instance (e.g., for multi-tenant), this would break.

---

## Tests gap analysis

| Endpoint | Integration test? | Unit test? | Notes |
|---|---|---|---|
| `GET /api/rider/hubs` | Yes (`tests/api/public-routes.test.ts:46`) | Yes (`web/src/server/modules/hubs/hub.use-cases.ts` has tests) | Coverage OK |
| `GET /api/rider/plans` | No | No | **GAP** — no end-to-end test of the plans listing |
| `POST /api/rider/plans` | No | Partial (only `INSUFFICIENT_BALANCE` branch in `planUseCases`) | **GAP** — full subscribe flow untested |
| `GET /api/rider/pricing` | No | No | **GAP** — dead endpoint, no test |
| `GET /api/vehicles?hubId=` | Yes (`tests/api/public-routes.test.ts:46`, `tests/integration/api-integration.test.ts:51`, `tests/load/vehicles-load.k6.ts`) | No | Server-side coverage OK |
| `POST /api/rental/book` | No | No | **GAP** — bookRental is a complex use case (lines 27-168) with race-condition guards, untested |
| `POST /api/rider/sync/pickup` | No | No | **GAP** — `syncPickup` has 100+ lines of business logic, untested |
| `POST /api/rider/rental/return` | No | No | **GAP** — `submitReturn` is a critical 170-line use case, untested |
| `flutter/integration_test` for end-rental | Yes (33_*.dart) but is a `expect(true, isTrue)` tautology (audit #8 P0-1) | No | **GAP** — no real assertion |
| `flutter/test/features/rentals/data/repository_impl_test.dart` | n/a | Yes (mocked) | Asserts the wrong endpoint (P0-2) |

**Headline:** the **4 most critical write endpoints** (book, pickup, return, plan subscribe) have **zero integration test coverage**. The end-rental Flutter integration test is a no-op (flagged in audit #8).

**Recommended test plan:**
1. **Server-side `submitReturn.test.ts`** — happy path, <4 photos → `PHOTOS_REQUIRED`, wrong state → `INVALID_STATE`, race condition → `RACE_CONDITION`. **4h.**
2. **Server-side `bookRental.test.ts`** — vehicle not found, vehicle unavailable, shift inactive, double-booking guard, atomicity. **6h.**
3. **Server-side `syncPickup.test.ts`** — vehicle race condition, photo persistence, lifecycle transition. **4h.**
4. **Flutter end-to-end:** `33_rental_end_test.dart` rewritten to actually POST to the server and assert 200. **2h.**

**Total: 16h of test work to bring rental lifecycle to 80%+ coverage.**

---

## Recommended fix order

| # | PR | Scope | Effort | Risk | Closes |
|---|---|---|---|---|---|
| 1 | **PR-7a: Fix end-rental request body shape** | Regenerate `VehicleReturnRequest`, update `VoltiumApiService.submitVehicleReturn` to use `returnPhotos[]` + `reason` + (optionally) `latitude`/`longitude`, wire `widget.onSuccess` to `rider_provider.refreshFromApi` + `Navigator.pop`, move PostHog capture into success branch. | 2h | Low (server is `.strict()`, so this is forced anyway) | P0-1, P0-4, P2-2, P2-3 |
| 2 | **PR-7b: Delete dead repository code** | Remove `RentalRepositoryImpl` (or fix `fetchHubs` to call `getRiderHubs` + delete `submitVehicleReturn`). Remove `RiderProvider.submitVehicleReturn`. Update test mocks. | 1h | Low | P0-2, P0-3, P1-4, P1-6 |
| 3 | **PR-7c: Consolidate rental API surface** | Pick option A or B from P1-4. Rename `VoltiumApiService` to `RentalApiService` under `features/rentals/data/`. Delete `features/rentals/domain/repository.dart` (or use it as the single source). Update 4 screens. | 2h | Medium (touches many files) | P1-4, P1-6 |
| 4 | **PR-7d: Schema cleanup** | Delete dead `endRentalSchema`. Move `returnSchema` to `rental.schemas.ts`. Add `hubId` to `subscribePlanSchema`. Regenerate OpenAPI spec + Flutter client. | 2h | Low | P1-1, P1-2, P1-5 |
| 5 | **PR-7e: Wire dynamic pricing into UI** | Add `getRiderPricing` call in `ChoosePlanScreen` (or `PickupHubScreen`), show `finalPrice` vs `basePrice`, "save X%" badge. | 4h | Low | P1-3 |
| 6 | **PR-7f: Split OpenAPI spec** | Separate `admin.openapi.ts` from `rider.openapi.ts`. Audit which admin methods the rider client should drop. Regenerate. | 1 day | High (changes 50+ generated files) | P1-7 |
| 7 | **Test sprint** | Server-side submitReturn/bookRental/syncPickup tests + Flutter end-to-end assertion fix. | 16h | n/a | Tests gap (all) |

**Total: ~3 days of focused work to close all P0s and 5/7 P1s. PR-7f (spec split) and the test sprint can be parallelized.**

---

## Architecture observations

### Two parallel API surfaces, one dead

The codebase has **two** ways to call rental endpoints:
- `features/rentals/data/repository_impl.dart` (dead, wrong in 2 ways)
- `services/voltium_api_service.dart` (used by 3 screens, also does auth, transactions, etc.)

The repository is the textbook "clean architecture" pattern. The service is the pragmatic shortcut. Neither is "the right one" — they're both wrong in different ways. **Recommendation:** pick one. The service is closer to what the screens actually need (it's a flat facade, not a domain abstraction); make it the source of truth and delete the repository. If you want a repository for testability, build one in the screens' own test setup rather than as a parallel production class.

### Pricing is a public-but-secret endpoint

`/api/rider/pricing` exists, returns tiered prices, has dynamic-discount logic, but the Flutter app doesn't show it. This is the same anti-pattern as the notifications feature (audit #7 P0-1 + audit #4 P0-4 — server emits them, app doesn't display them) and the referral code (audit #13 — server processes them, app doesn't send them). **The pattern is: features are built server-side, partially wired in the client, then forgotten.** A "feature adoption dashboard" that tracks "endpoint exists / client calls it / user-visible" would surface this.

### Hardcoded plan list in the pricing route

`/api/rider/pricing` (`pricing/route.ts:8-12`) hardcodes:
```ts
const PLANS = [
  { id: 'daily', name: 'Daily Flex', basePrice: 180 },
  { id: 'weekly', name: 'Weekly Pro', basePrice: 999 },
  { id: 'monthly', name: 'Monthly Max', basePrice: 2999 },
];
```

The actual plans come from the database (via `planUseCases.listActivePlans()` and `getRiderPlans()`). The pricing route ignores the DB. **Two sources of truth for "what plans exist"** — admin-side add/edit will not affect the dynamic pricing view. This is a known footgun (audited in the rental details audit as a P0) — the plan-management system in the admin panel is decoupled from the rider-facing pricing.

### End-rental flow's optimistic UI lies to the user

`EndRentalScreen._handleReturn` (line 192-195) sets `_submitted = true` after a 2s `await Future.delayed`, then shows the green checkmark — **before** the server has confirmed the return row exists. The await on `api.submitVehicleReturn` happens first (correct), but the **2-second delay is fictional** — the user is shown "Request Submitted!" before the actual database state is verified. If the server has a 3s response time, the user sees "Submitted" while the request is still in flight. **Fix:** remove the `Future.delayed` and let the await on `refreshFromApi` (post-P0-4 fix) be the source of truth.

### `rental_details_screen.dart:243-250` end-rental button bypasses `AuthState` routing

Audit #8 P0-2 noted that `RentalDetailsScreen` is not in the `AuthState` enum, so lifecycle changes (rental ended → `RETURN_PENDING`) don't re-route the rider. The `EndRentalScreen` is pushed via `MaterialPageRoute` rather than through the auth-gated router. After the return succeeds, the rider remains on a screen that still shows `status.toUpperCase() = 'ACTIVE'` (because no refresh). This is a fundamental architecture issue — the entire rental details view should be reactive to `lifecycleStatus` and either show a "Return under review" state or auto-navigate.

---

## Out of scope for this audit

- **Rent-due collection** — the auto-debit logic, `rent-due-emitter` cron, and the wallet-side `WalletService.deductRent` are a separate flow. Audited separately in `ADMIN_DATAMGMT_EARNINGS_JOBS_AUDIT_2026-08-05.md`.
- **Admin review of vehicle returns** — the `postAdminKyc` review flow + `vehicleReturn` admin queue is covered in `ADMIN_FINANCE_AUDIT_2026-08-05.md`.
- **Security deposit refund** — happens in the admin flow after return approval, not the rider flow.
- **Vehicle condition scoring** — `pickupPhoto*` and `photoLeft/Right/Front/Speedometer` are stored on the rider row but the scoring module that uses them is in `web/src/server/modules/scores/`, separate concern.
- **The actual photo upload (multipart)** — `POST /api/files/request-upload` + `/api/files/confirm-upload` is a separate flow; the `uploadFile` helper in `VoltiumApiService` abstracts it. No issues observed in the rental lifecycle's use of it.
- **`VehicleSearchSheet`** in `pickup_hub_screen.dart:213-230` — UI for selecting a vehicle from a list; not audited here (no API call in the sheet itself, just a callback).

---

## Cross-audit themes this audit confirms

1. **Dead code is a maintenance hazard** — 6+ dead widgets/screens in audits #7-#13, and now a dead repository with broken method signatures (P0-2, P0-3, P1-4). The codebase accumulates stale code faster than it gets cleaned up.
2. **Generated client vs web schema drift** — the OpenAPI spec was regenerated at a different time from when the web routes were last edited, leading to body shape mismatches (P0-1, P1-1). Every P0 in this audit is rooted in drift between `flutter/lib/core/network/generated/api_models.dart` and the live `web/src/app/api/**/route.ts` files.
3. **Two API surfaces per feature** — the repository pattern was started but never finished; the service facade is the de-facto layer. Same story in support (`SupportRepository` + `supportProvider` + `ticketProvider` per audit #9).
4. **Server-side features that the rider app doesn't surface** — `getRiderPricing` (P1-3), `getRiderHubs` (works), `getRiderPlans` (works), `postRentalBook` (P0-class dead client method), `submitReturn`'s `latitude`/`longitude` (P2-3). The pattern of "server builds it, app never shows it" recurs in notifications (audit #7 + #4) and referral (audit #13).

---

## Cross-audit links

- Audit #8 (Rental Details, P0-1, P0-2) — same `EndRentalScreen` `onSuccess` not wired, same `RentalDetailsScreen` not in `AuthState`.
- Audit #7 (Dashboard, P0-4) — same `RiderNotifier.logout()` doesn't clear providers.
- Audit #14 (Auth Flow, P0-1) — same "endpoint exists, Flutter doesn't call it" pattern.
- Audit #9 (Support, P1-1) — same hardcoded FAQ/contact info theme.
- Audit #6 (Data Mgmt + Jobs, P0-1) — same "DR tab calls wrong route" anti-pattern.

---

**End of audit.** Recommend starting with PR-7a (P0-1) — it's a 2h fix that unblocks the most critical broken feature and is forced anyway by the server's `.strict()` schema.
