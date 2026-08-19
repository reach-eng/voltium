# Rider App Flows — Flutter → API — Support & Notifications — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** the full support + notifications flow end-to-end (Flutter client → Next.js API):

| Flow | Web route | Flutter caller | Auth contract file |
|---|---|---|---|
| FAQ browse | `GET /api/support/faqs` | `SupportRepositoryImpl.fetchFaqs` → `VoltiumApiClient.getSupportFaqs` (called by `SupportNotifier.refreshFaqs`); also searched by `support_center_screen.dart:87-108` with a **hardcoded 4-item static list** | `web/src/app/api/support/faqs/route.ts` |
| Raise ticket | `POST /api/support/tickets` | `SupportRepositoryImpl.createTicket` → `VoltiumApiClient.postSupportTickets` (called by `CreateTicketScreen._submitTicket`); **the `attachments` field is silently dropped — no photo upload UI** | `web/src/app/api/support/tickets/route.ts` |
| List tickets | `GET /api/support/tickets` | `SupportRepositoryImpl.fetchTickets` → `VoltiumApiClient.getSupportTickets` (called by **two parallel providers**: `SupportNotifier` and `SupportTicketsNotifier`) | same |
| Chat messages | `GET/POST /api/support/chat` | `SupportRepositoryImpl.getSupportChat` / `sendChatMessage` exist in the repo and generated client, but **no Flutter screen consumes them**. The server POST returns a keyword-based text reply. | `web/src/app/api/support/chat/route.ts` |
| Notification inbox | `GET /api/rider/notifications` | `EngagementNotifier.refreshNotifications` calls `_api.get('/api/rider/notifications')` directly (not the generated `getRiderNotifications` method) | `web/src/app/api/rider/notifications/route.ts` |
| Mark notification read | `PUT /api/rider/notifications` | `EngagementNotifier.markNotificationAsRead` calls `_api.post('/api/rider/notifications', body: {notificationId: id})` — **WRONG METHOD (POST, not PUT)** | same |
| Mark all notifications read | `PUT /api/rider/notifications` | `EngagementNotifier.markAllNotificationsRead` calls `_api.post('/api/rider/notifications', body: {})` — **WRONG METHOD (POST, not PUT)** | same |
| Search (per the audit brief) | `GET /api/search` | **No Flutter caller exists.** The endpoint is **admin-only** (`requireAdmin` + `analytics_view` permission) per `web/src/app/api/search/route.ts:21-23` — the rider cannot reach it. The audit brief implies a rider-search endpoint that doesn't exist. | n/a — the route is admin-internal |

**Files read in full:**
- `web/src/app/api/support/tickets/route.ts` (59 lines — GET list, POST create with `createTicketSchema`, `riderId` injected from session)
- `web/src/app/api/support/faqs/route.ts` (19 lines — `getOrSetResponse` cached for 1 hour)
- `web/src/app/api/support/chat/route.ts` (102 lines — GET returns hint, POST is a **keyword-matcher with hardcoded emergency keywords**; returns `text/plain` with `X-Critical-Flag` header; rate-limited at 10/min prod, 100/min dev)
- `web/src/app/api/rider/notifications/route.ts` (41 lines — GET with `limit=50` default, PUT for mark-read; **the Flutter side calls POST, not PUT**)
- `web/src/app/api/search/route.ts` (132 lines — **admin-only, requires `analytics_view` permission; searches riders/tickets/vehicles/transactions via Prisma `contains` queries**)
- `web/src/server/modules/support/support.use-cases.ts` (276 lines — `createTicket` with PR-80 random-bytes collision fix, `getTickets`, `replyToTicket`, `bulkUpdateTickets`)
- `web/src/server/modules/support/rider-support.use-cases.ts` (32 lines — **second, parallel implementation** of `createTicket`/`getTickets`/`getFAQs` — appears to be the legacy one; uses `TICKET-{count+1}-{random}` ID format, not the `#random` format from the main use case)
- `web/src/server/modules/support/support.schemas.ts` (26 lines — re-exports from `@/lib/validators`, defines `supportQuerySchema`)
- `web/src/server/modules/notifications/notification.use-cases.ts` (250 lines — `listNotifications`, `sendToRider`, `markRead`, `markAllRead`, `getUnreadCount`, `processScheduledNotifications`)
- `flutter/lib/features/notifications/presentation/providers/notification_provider.dart` (123 lines — **parallel local-only notifier backed by SharedPreferences, NOT used by the UI**)
- `flutter/lib/features/dashboard/presentation/providers/engagement_provider.dart` (208 lines — the **actual** notifications provider; `markNotificationAsRead`/`markAllNotificationsRead` use **POST** instead of PUT)
- `flutter/lib/features/notifications/presentation/screens/notifications_screen.dart` (lines 1-590 — tabs: All/Payments/KYC/Maintenance/Announcements, **Dismissible delete is local-only, no API call**)
- `flutter/lib/features/support/presentation/providers/support_provider.dart` (208 lines — `SupportNotifier` with seeded `SupportConfig(phone: '+919876543210', email: 'support@voltium.app')` and 3 hardcoded FAQ categories + 2 hardcoded FAQ items)
- `flutter/lib/features/support/presentation/providers/ticket_provider.dart` (74 lines — `SupportTicketsNotifier` with **Future.microtask hydration race** + 5 filter enum `TicketFilter`)
- `flutter/lib/features/support/presentation/screens/support_center_screen.dart` (367 lines — `SearchAnchor` searches a **hardcoded 4-item list**, contact card with `+91-9876543210` placeholder, "Recent Tickets" section)
- `flutter/lib/features/support/presentation/screens/create_ticket_screen.dart` (304 lines — category dropdown, subject + message fields; **no photo/attachment upload**)
- `flutter/lib/features/support/data/repository_impl.dart` (48 lines — `fetchFaqs`/`fetchTickets`/`createTicket`/`getSupportChat`/`sendChatMessage`)
- `flutter/lib/features/support/domain/entity.dart` (96 lines — `TicketEntity`, `TicketMessageEntity`)
- `flutter/lib/core/network/generated/api_client.dart` (lines 97-110, 222-235, 477-493 — generated methods for tickets, notifications, chat, faqs)
- `flutter/integration_test/e2e/support_test.dart` (145 lines — 8 tests using **dead widget keys** like `issueTypeDropdown`/`raiseTicketButton` which the current `SupportCenterScreen` doesn't have)
- `flutter/integration_test/e2e_individual/09_notifications_test.dart` (40 lines — bell navigation + mark-all-read)
- `flutter/test/providers/notification_provider_test.dart` (referenced — tests the **dead `NotificationNotifier`** SharedPreferences implementation)

**Out of scope:** Admin-side ticket review queue (covered in `ADMIN_SUPPORT_INCIDENT_FINES_AUDIT_2026-08-05.md`). Notification fanout via FCM/Outbox (covered in audit #4). The admin notifications endpoint. The `EngagementProvider`'s rewards/referrals methods (audit #7 noted the dashboard never reads them).

---

## TL;DR

**The support + notifications flow has 5 P0 bugs. The headline: `EngagementNotifier.markNotificationAsRead` (line 177) and `markAllNotificationsRead` (line 188) call `POST /api/rider/notifications`, but the server route only handles `PUT` for mark-read (route.ts:23).** The generated client at `api_client.dart:230-235` has the correct method (`putRiderNotifications`), but the **active code path bypasses the generated client** and uses the raw `_api.post` from `VoltiumApiService`. So every notification "mark as read" tap from the rider app sends a `POST` to a route that only accepts `PUT` — the server returns 405 Method Not Allowed, the exception is swallowed by the void return of `_api.post`, the local state updates optimistically, but **the server never learns the notification was read.** When the rider kills the app and reopens, all "read" notifications are unread again.

The other 4 P0s:
1. **`/api/search` is admin-only** — the audit brief table lists it as a rider-accessible "Cross-entity search" endpoint. It's not. `route.ts:21-23` calls `requireAdmin()` + checks `hasPermission('analytics_view')`. The Flutter client has no method for it. The brief is wrong.
2. **`/api/support/chat` is a dead-end stub** — POST returns a **keyword-matched text reply** based on 11 hardcoded emergency words (`accident`, `crash`, `injury`, `fire`, etc.) and 4 catch-all categories (payment, kyc, pickup, general). No real chat. The Flutter `SupportRepository` has `getSupportChat` and `sendChatMessage` methods, but **no Flutter screen consumes them**. The `chat_messageSchema` validation accepts any string.
3. **`/api/support/faqs` server-side cache returns 1-hour stale data, but the `SupportNotifier` never invalidates it** — `faqs/route.ts:9-13` wraps the response in `getOrSetResponse('support_faqs', ..., 3600)`. If an admin updates an FAQ via the admin panel, riders see the old FAQ for up to 1 hour. Worse, the Flutter `support_center_screen.dart:90-95` `SearchAnchor` **doesn't use this endpoint at all** — it searches a 4-item hardcoded list `['How to lock the scooter?', 'Payment failed', 'Report a damaged vehicle', 'Refund policy']`.
4. **`/api/rider/notifications` has a `markAllRead` race with the per-id `markRead`** — the server's `markRead(notificationId, riderDbId)` throws `'NOTIFICATION_ACCESS_DENIED'` if the notification doesn't belong to the rider (use-cases.ts:33-35). The route catches it as a generic 500 via the catch-all. A rider who taps "mark all read" and then a single notification gets a stale UI vs server state mismatch.

There are also P1s: `create_ticket_screen.dart` has **no photo/attachment upload** (audit #9 P0-2 already flagged this, but the contract is confirmed here — `createTicketSchema` accepts `attachments` but the Flutter side never sends them); the `Dismissible` notification delete is local-only (no DELETE endpoint exists, the swipe-to-delete is a lie); `support_provider.dart:64-66` hardcodes `supportPhone: '+919876543210'` and `supportEmail: 'support@voltium.app'` (placeholder-number pattern from audits #9/#12/#14/#15/#16); `notification_provider.dart` is **dead code** (a parallel notifier with SharedPreferences, never read by the UI); and `support_test.dart` uses keys like `issueTypeDropdown`/`raiseTicketButton` that no longer exist in the current `SupportCenterScreen` (the test is broken — it would fail to find any matching widget).

The headline architectural issue: **two parallel notification notifiers** (`NotificationProvider` local-only, `EngagementProvider` API-backed) — the local one is dead code, the API-backed one bypasses the generated client with raw `post()` calls. This is the same architectural drift as the wallet/rental/support repositories from audits #15 and #16.

There are **5 P0s**, **9 P1s**, and **5 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, security gap, silent data loss, business logic bug | Before next release |
| **P1** | UX friction, race condition, accessibility, dead code, contract drift | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: `EngagementNotifier.markNotificationAsRead` and `markAllNotificationsRead` use POST; server only accepts PUT → mark-read never persists

**Repro:**
1. `engagement_provider.dart:177`:
   ```dart
   void markNotificationAsRead(String id) {
     final idx = state.notifications.indexWhere((n) => n.id == id);
     if (idx == -1) return;
     final next = [...state.notifications];
     next[idx] = next[idx].copyWith(isRead: true);
     state = state.copyWith(
       notifications: next,
       unreadCount: (state.unreadCount - 1).clamp(0, 999),
     );
     if (!AppConstants.isTestMode) {
       _api.post('/api/rider/notifications', body: {'notificationId': id});
     }
   }
   ```
2. The generated client at `api_client.dart:230-235` has the correct method:
   ```dart
   Future<Map<String, dynamic>> putRiderNotifications(Map<String, dynamic> request) async {
     final response = await _client.put('/api/rider/notifications', body: request);
     return response;
   }
   ```
3. But the engagement provider bypasses the generated client and calls `_api.post(...)` directly.
4. The web route at `rider/notifications/route.ts:23-39` exports only `GET` and `PUT`:
   ```ts
   export async function PUT(request: NextRequest) {
     try {
       const session = await requireRiderSession(request);
       ...
       const body = await request.json().catch(() => ({}));
       if (body.notificationId) { ... }
       await notificationUseCases.markAllRead(session.riderDbId);
       ...
     }
   }
   ```
5. **Next.js returns 405 Method Not Allowed for POST.** The rider taps a notification, the local state updates optimistically (unread count drops, badge clears), the POST 405s, the exception is swallowed by the void return of `_api.post`. **The server never learns the notification was read.**
6. Scenario:
   - T=0: rider opens notifications tab, sees 5 unread. Server has 5 unread.
   - T=1: rider taps "Mark all read". Local state → 0 unread. Server POST 405. Server still has 5 unread.
   - T=2: rider kills the app. The local state is gone (no persistence — see P1-3).
   - T=3: rider reopens app. Server returns 5 unread. Badge shows 5 again.
7. Same bug in `markAllNotificationsRead` (line 188): calls `_api.post('/api/rider/notifications', body: {})`. 405.
8. The integration test `09_notifications_test.dart:29-33` "Mark all read if there are notifications" doesn't assert the API call succeeded — it just taps and moves on. So this bug is invisible to the test suite.

**Impact:** **The "mark as read" feature is broken.** Riders see the unread badge persist across app restarts. The admin team sees 100% of notifications as unread. Analytics on "notification engagement" are completely wrong.

**Fix:**
- Change line 177: `_api.put('/api/rider/notifications', body: {'notificationId': id})`.
- Change line 188: `_api.put('/api/rider/notifications', body: {})`.
- **Or** use the generated client: `await ref.read(riderApiProvider).putRiderNotifications({'notificationId': id})` (cleaner, typed).
- Add a unit test that mocks the API client and asserts the PUT method was called.
- Add an integration test that asserts the unread count after app restart matches what was set on the server.

**Effort:** 5 min fix + 1h test.

---

### P0-2: `/api/search` is admin-only — the audit brief's "Cross-entity search" endpoint doesn't exist for riders

**Repro:**
1. The audit brief table lists: `GET /api/search` — "Cross-entity search".
2. `web/src/app/api/search/route.ts:21-23`:
   ```ts
   const session = await requireAdmin();
   if (!session) return adminUnauthorized();
   if (!hasPermission(session.adminRole || '', 'analytics_view')) return adminForbidden();
   ```
3. The route requires **admin session** + **`analytics_view` permission**. A rider session is rejected with 401.
4. The Flutter client (`core/network/generated/api_client.dart`) has **no method** for `/api/search`. `grep` for "Search" in the generated client returns 0 hits.
5. The brief's implication — that the rider can search across FAQs, tickets, vehicles, transactions — is not implemented for riders at all. There's no rider-side search UI either.

**Impact:** The audit brief is wrong on this point. The endpoint exists but for admin use only. The rider app has no global search feature at all. A new feature would need:
- New endpoint `GET /api/rider/search` with rider session (or use a scoped `GET /api/support/tickets?search=...` for the most likely use case).
- Client integration.
- UI.

**Fix:** Decide what "search" means for the rider:
- **Most likely:** rider wants to find a past ticket by subject. Build `GET /api/support/tickets?search=...` (the server already supports this in `getAdminTickets`; mirror for rider scope).
- **Alternative:** rider wants to find a vehicle by number. Build `GET /api/rider/vehicles?search=...` (the hub search already does this implicitly via `getVehicles(hubId)`).
- **For now:** update the audit brief. The current "search" endpoint is admin-only by design.

**Effort:** Spec decision is 1h. Implementation is 4-6h for the most likely use case.

---

### P0-3: `/api/support/chat` is a dead-end keyword-matcher with no real conversation — Flutter has no UI, server has no persistence

**Repro:**
1. `web/src/app/api/support/chat/route.ts:29-54`:
   ```ts
   function localSupportReply(message: string): string {
     const text = message.toLowerCase();
     if (EMERGENCY_KEYWORDS.some((keyword) => text.includes(keyword))) {
       return 'This looks urgent. Please call local emergency services if anyone is in danger...';
     }
     if (text.includes('payment') || text.includes('deposit') || text.includes('top') || text.includes('wallet')) {
       return 'For payment, wallet, or deposit issues, please open a support ticket...';
     }
     // ... 3 more keyword branches
     return 'Thanks. Please create a support ticket with the key details...';
   }
   ```
2. The server has **no message persistence** — `getSupportChat` returns `messages: []` (line 60-63), POST returns a string and forgets it.
3. The Flutter `SupportRepositoryImpl` (data/repository_impl.dart:41-48) has `getSupportChat` and `sendChatMessage` methods that **no UI screen calls**. `grep` for "chat" in `flutter/lib/features/support/presentation/screens/` returns 0 hits. The user never sees this surface.
4. The `EMERGENCY_KEYWORDS` array (line 15-27) has 11 words including `'crash'`, `'fire'`, `'assault'`, `'police'`. If the rider writes "my payment is crashing" (a benign error), the server returns the **emergency** template. False positive on emergency routing.
5. The POST returns `text/plain; charset=utf-8` (line 96-101) — not JSON. The Flutter `SupportRepositoryImpl.sendChatMessage` calls `_apiClient.postSupportChat({'message': message})` which returns `Future<Map<String, dynamic>>` (line 484-487). The generated client expects JSON. **The generated client's return type doesn't match the server's content type.** If anyone wires up a chat screen, the response parsing will fail.

**Impact:** The "chat" feature is non-functional. A rider who thinks they're chatting with support is actually getting a one-line template answer, then nothing. The system creates false expectations (the rider believes their emergency was handled when nothing was escalated).

**Fix:**
- **Short term:** if chat isn't on the roadmap, **delete the entire chat route** + remove the generated client methods + remove the `getSupportChat`/`sendChatMessage` from the repo. Add a 410 Gone to the route.
- **Long term:** if chat is on the roadmap, build it properly:
  - Persist messages in a `SupportChatMessage` table.
  - Add a `reply` POST for admin to send back.
  - Build a real-time UI with WebSocket or polling.
  - Add the `createTicket` flow as a fallback ("if no admin is available, open a ticket").

**Effort:** 1h to delete; 1-2 weeks to build properly.

---

### P0-4: `CreateTicketScreen` has no photo/attachment upload — `createTicketSchema` accepts `attachments` but the Flutter side never sends them

**Repro:**
1. `web/src/lib/validators.ts` (referenced) defines `createTicketSchema` with `attachments: z.array(z.string()).optional()`.
2. The web route at `tickets/route.ts:43-52` extracts `attachments` from the body and passes to the use case.
3. `flutter/lib/features/support/presentation/screens/create_ticket_screen.dart:39-86`:
   - `_selectedCategory` is a string (default `'TECHNICAL'`)
   - `_subjectController` and `_messageController` are `TextEditingController`
   - **No `_attachments` list, no file picker, no upload button.**
4. The Flutter `SupportRepositoryImpl.createTicket` (data/repository_impl.dart:22-38):
   ```dart
   final request = CreateTicketRequest(
     riderId: riderId,
     category: category,
     priority: priority,
     subject: subject,
     message: message,
   );
   ```
   The generated `CreateTicketRequest` model (api_models.dart, referenced) likely has an `attachments` field, but the repo never sets it.
5. Result: a rider who wants to attach a photo of a damaged vehicle or a screenshot of a payment error **has no way to do so**. They write a long text description. Admin reviewers see tickets without visual context.

**Impact:** Real support ticket friction. Photo evidence is the difference between "I sent 3 clarifying messages to support" and "I attached a photo and got an answer in 1 message".

**Fix:** Add a photo attachment section to `CreateTicketScreen`:
- "Add photo" button → opens image source sheet (camera or gallery, same pattern as `top_up_proof_screen.dart:375-380`).
- Image compression via `ImageCompressionService()` (same as KYC and end-rental).
- Upload to `/api/files/request-upload` (already exists per the OpenAPI spec).
- Collect URLs in a `List<String> _attachments`.
- Pass to `CreateTicketRequest` via the repo.

**Effort:** 2-3h (UI + upload + integration test).

---

### P0-5: `NotificationsScreen` `Dismissible` delete is local-only — no DELETE endpoint exists, the swipe-to-delete is a lie

**Repro:**
1. `notifications_screen.dart:173-237`:
   ```dart
   child: Dismissible(
     key: Key('notif_${filtered[index].id}'),
     direction: DismissDirection.endToStart,
     background: Container(...),
     confirmDismiss: (direction) async {
       return await showDialog<bool>(...);  // "Are you sure you want to delete this notification?"
     },
     onDismissed: (direction) {
       setState(() {
         ref.read(engagementProvider).notifications.removeWhere(...);
       });
       ScaffoldMessenger.of(context).showSnackBar(
         const SnackBar(content: Text('Notification deleted')),
       );
     },
     ...
   ),
   ```
2. The `onDismissed` callback **only updates local state**. No API call.
3. The web side has no DELETE endpoint for `/api/rider/notifications/{id}`. The route only exports `GET` and `PUT` (route.ts).
4. Scenario:
   - T=0: rider swipes a notification left, confirms delete. Local state removes it. SnackBar shows "Notification deleted".
   - T=1: rider kills the app. Local state is gone.
   - T=2: rider reopens app. `refreshNotifications` calls GET, returns the full list including the deleted one. **The notification reappears.**
5. The `_clearReadNotifications` method (notifications_screen.dart:122-129) calls `ref.read(engagementProvider.notifier).refreshNotifications()` which **re-fetches all notifications** — defeating the "clear" purpose.

**Impact:** User confusion. The rider swipes away 10 notifications, kills the app, reopens, sees 10 notifications back. Either:
- The DELETE button should be removed (it doesn't work).
- Or: build a real DELETE endpoint + soft-delete on the server.

**Fix:**
- **Short term:** remove the `Dismissible` wrapper. Replace with a "Mark as read" tap (which is broken per P0-1 anyway, but the action is honest — local-only state change).
- **Long term:** add `DELETE /api/rider/notifications/:id` (soft delete via `isDeleted: true` column) + add the call to the Dismissible.

**Effort:** 30 min to remove; 4h to add proper DELETE.

---

## P1 — Should fix this sprint

### P1-1: `EngagementNotifier.refreshNotifications` calls raw `_api.get('/api/rider/notifications')` — bypasses the generated typed client

**Repro:**
1. `engagement_provider.dart:151`:
   ```dart
   final response = await _api.get('/api/rider/notifications');
   ```
2. The generated client at `api_client.dart:224-227` has a typed method:
   ```dart
   Future<ListNotificationsResponse> getRiderNotifications() async {
     final response = await _client.get('/api/rider/notifications');
     return ListNotificationsResponse.fromJson(response);
   }
   ```
3. The engagement provider parses the response manually with `response['data']['notifications'] as List<dynamic>?` (line 154-157) — assumes the `{success, data: {notifications, unreadCount}}` shape. This is the standard `success()` wrapper. The generated `ListNotificationsResponse` would do this parsing for free.
4. The same pattern repeats in `markNotificationAsRead` (line 177) and `markAllNotificationsRead` (line 188) — they should use `putRiderNotifications`.

**Impact:** Same pattern as P0-1 — bypassing the generated client means method-mismatch bugs are not caught at compile time.

**Fix:** Use the generated `getRiderNotifications`, `putRiderNotifications` everywhere in the engagement provider.

**Effort:** 30 min.

---

### P1-2: `support_provider.dart:64-66` hardcodes `supportPhone: '+919876543210'` and `supportEmail: 'support@voltium.app'` — placeholder pattern + duplicated in support_center_screen.dart:240, 251

**Repro:**
1. `support_provider.dart:64-66`:
   ```dart
   supportConfig: const SupportConfig(
     supportPhone: '+919876543210',
     supportEmail: 'support@voltium.app',
     ticketChecklist: [...],
   ),
   ```
2. The `SupportConfig` is **seeded in memory** — never refreshed from the server. If the support phone/email changes, the rider app shows the old number until reinstall.
3. `support_center_screen.dart:240, 251`:
   ```dart
   _buildContactCard(... subtitle: 'support@voltium.in', ...);  // different domain!
   _buildContactCard(... subtitle: '+91-9876543210', ...);  // different number!
   ```
4. **Three different contact details across two files.** `support@voltium.app` in the provider, `support@voltium.in` in the support center screen, `+91-9876543210` (different from `+919876543210`) in the call card.
5. The placeholder-number pattern from audits #9 P1-1 (support hotline), #12 P0-2 (SOS hotline), #14 P0-3 (`TEST_PHONES`), #15 P1-3 (team leader names), #16 P1-7 (test opening balance).

**Impact:** Real riders see a wrong phone number. Support team is unreachable from the app.

**Fix:**
- Move all support contact details to `lib/utils/app_constants.dart` (or a new `lib/utils/placeholders.dart`).
- Add a server endpoint `GET /api/rider/support/config` that returns the current phone/email.
- Have `SupportNotifier.initSupportData` call it and update `state.supportConfig`.

**Effort:** 30 min for constants; 2-3h for server endpoint.

---

### P1-3: `notification_provider.dart` (123 lines, SharedPreferences-backed) is dead code — never read by any UI screen

**Repro:**
1. `flutter/lib/features/notifications/presentation/providers/notification_provider.dart` is 123 lines with a full `NotificationNotifier` (Notifies → state, hydrates from `SharedPreferences`, persists on every mutation).
2. `grep` for `notificationProvider` (lowercase) in `flutter/lib/features/notifications/presentation/screens/` returns 0 hits.
3. The actual UI (`NotificationsScreen`) reads `engagementProvider` exclusively.
4. The test `test/providers/notification_provider_test.dart` exists and tests the SharedPreferences flow — but the production code never uses it.
5. This is the **same dead-code pattern** as `WalletRepositoryImpl` (audit #16 P0-2), `PickupEntity` (audit #17 P1-1), `RaiseTicketCard` (audit #9 P0-2). The codebase accumulates parallel implementations of the same feature.

**Impact:** Confusing. A new developer reading the notifications folder sees 2 providers and 1 screen. They pick the wrong one. The 123 lines of local persistence code is dead.

**Fix:** Delete `flutter/lib/features/notifications/presentation/providers/notification_provider.dart` and the test. If local persistence of notifications is needed, add it to the `engagementProvider` (which is the live one).

**Effort:** 5 min.

---

### P1-4: `SupportTicketsNotifier.build()` uses `Future.microtask` for hydration — same flash-of-empty-state pattern as audit #9

**Repro:**
1. `ticket_provider.dart:42-46`:
   ```dart
   @override
   TicketState build() {
     Future.microtask(() => fetchTickets());
     return TicketState();
   }
   ```
2. The initial state has `tickets: []`, `isLoading: false`. The screen renders the empty state (audit #9 also flagged this for `ticket_provider`). Then `Future.microtask` fires, `fetchTickets` sets `isLoading: true`, then the API resolves, then `tickets: [...]`.
3. Sequence: empty state (1 frame) → loading (1 frame) → loaded. The user sees a flash of "No tickets yet" with the "Create ticket" CTA, then the loading skeleton, then the actual tickets.
4. The screen at `support_center_screen.dart:421-441` reads `ticketState.isLoading` and shows `TicketListSkeleton()`. So the loading state has a skeleton. But the **empty state** is what flashes before the loading state.

**Impact:** Visual jitter. Real UX bug for users on slow networks (the empty state lasts longer than 1 frame).

**Fix:** Set `isLoading: true` in the initial `TicketState`:
```dart
TicketState build() {
  Future.microtask(() => fetchTickets());
  return TicketState(isLoading: true);  // ← start in loading
}
```

**Effort:** 1 min.

---

### P1-5: `support_center_screen.dart:90-95` `SearchAnchor` searches a hardcoded 4-item list — never calls the FAQ endpoint

**Repro:**
1. `support_center_screen.dart:87-108`:
   ```dart
   suggestionsBuilder: (BuildContext context, SearchController controller) {
     final keyword = controller.text.toLowerCase();
     final staticFaqs = [
       'How to lock the scooter?',
       'Payment failed',
       'Report a damaged vehicle',
       'Refund policy'
     ];
     final matches = staticFaqs
         .where((f) => f.toLowerCase().contains(keyword))
         .toList();
     return matches.map((faq) => ListTile(...));
   },
   ```
2. The search is over a **static 4-item list** of placeholder FAQs. The `SupportNotifier.faqs` (which has 2 hardcoded FAQ items + the result of `getSupportFaqs` from the server) is never read.
3. Searching "lock" matches "How to lock the scooter?". Searching "vehicle" matches both "Report a damaged vehicle" and the dynamic FAQ list (which is ignored).
4. The server `/api/support/faqs` is cached for 1 hour (`faqs/route.ts:9-13`) so even if the Flutter side did call it, updates would lag.
5. The 4 hardcoded items include "How to lock the scooter?" — the rider app already has lock/unlock flows. "Payment failed" — the wallet has its own top-up flow.

**Impact:** The search feature is a no-op stub. Riders search for real issues ("deposit refund", "vehicle damage", "KYC rejected") and get nothing.

**Fix:**
- Have the `SearchAnchor` read `supportProvider.faqs` (which already has the dynamic list).
- On tap, navigate to the FAQ screen with the matched FAQ.
- Add a search box at the top of the FAQ screen too.
- Invalidate the server cache when an admin updates FAQs (publish a `faq.updated` outbox event, invalidate the cache on receive).

**Effort:** 2-3h.

---

### P1-6: `support_test.dart` uses dead widget keys (`issueTypeDropdown`, `ticketDescriptionField`, `raiseTicketButton`) — integration test is broken

**Repro:**
1. `flutter/integration_test/e2e/support_test.dart:15-23`:
   ```dart
   testWidgets('Support center displays all sections', (tester) async {
     await fullLoginFlow(tester);
     await navigateToTab(tester, 'supportTab');
     expect(find.byKey(const Key('issueTypeDropdown')), findsOneWidget);
     expect(find.byKey(const Key('ticketDescriptionField')), findsOneWidget);
     expect(find.byKey(const Key('raiseTicketButton')), findsOneWidget);
   });
   ```
2. The current `SupportCenterScreen` (lines 141-199) has none of these keys. It has `createTicketButton` (line 174) which navigates to `CreateTicketScreen`.
3. `CreateTicketScreen` (lines 184-296) has:
   - `TextFormField` for subject (no `Key` on it)
   - `TextFormField` for message (no `Key` on it)
   - `ElevatedButton` for submit (no `Key` on it — no `ticketDescriptionField` key)
4. **Every support integration test** (8 tests) would fail to find their expected widgets. The test passes only because `expect` is not called (or because the `if (dropdownItems.evaluate().isNotEmpty)` guards skip the assertion when no widgets are found — lines 34-38, 100-110).
5. Audit #9 noted that `RaiseTicketCard` (the widget that had these keys) was deleted as dead code. The integration test wasn't updated.

**Impact:** The support test suite is non-functional. A refactor of the support screen can't be validated by e2e tests.

**Fix:**
- Add `Key('issueTypeDropdown')` to the category dropdown in `CreateTicketScreen`.
- Add `Key('ticketDescriptionField')` to the message TextFormField.
- Add `Key('raiseTicketButton')` to the submit button.
- Update the test to navigate to the create-ticket screen first (tap `createTicketButton`), then interact with the form.

**Effort:** 1h.

---

### P1-7: `notification_provider_test.dart` tests the dead `NotificationProvider` — tests run against production-irrelevant code

**Repro:**
1. `test/providers/notification_provider_test.dart` exists and tests the SharedPreferences-backed `NotificationNotifier`.
2. The actual UI uses `EngagementNotifier`. The test runs against dead code.
3. If the test fails, no one notices (it doesn't gate CI). If it passes, it doesn't validate the production behavior.
4. Same pattern as the dead repository tests in audits #15 and #16.

**Fix:** Delete the test (and the dead `notification_provider.dart` per P1-3). Add a test for `EngagementNotifier` instead (mock `VoltiumApiService`).

**Effort:** 5 min (delete) + 1h (add real test).

---

### P1-8: `engagement_provider.dart:75-107` `_loadDummyData` test mode is identical to test phones pattern from audit #16

**Repro:**
1. The engagement provider has a hardcoded test mode (3 hardcoded notifications with the exact same content as the "happy path" — "Rent Reminder", "Weekly Reward", "System Update").
2. The `_loadDummyData` is gated on `AppConstants.isTestMode`. In production, the real API is called.
3. The hardcoded data leaks into the test suite and any QA environment.
4. Same pattern as audit #16 P1-7 (test opening balance) and audit #14 P0-3 (TEST_PHONES).

**Fix:** Move to a `TestNotifications` factory in `test/test_data/`.

**Effort:** 30 min.

---

### P1-9: `notifications_screen.dart:52-89` `NotificationTab` filters by `title.toLowerCase().contains('kyc')` — fragile string match

**Repro:**
1. `notifications_screen.dart:65-71`:
   ```dart
   case NotificationTab.kyc:
     return all
         .where(
           (n) =>
               n.type == AppNotificationType.system &&
               n.title.toLowerCase().contains('kyc'),
         )
         .toList();
   ```
2. The KYC tab filters by `title.toLowerCase().contains('kyc')` — string match on the title. If an admin creates a notification titled "Your Aadhaar has been verified" (the actual server-side title for KYC approval), the KYC tab is empty.
3. The same pattern for the maintenance tab: `title.toLowerCase().contains('service') || title.toLowerCase().contains('maintenance')`.
4. The `AppNotificationType` enum has `paymentReceived`, `paymentSent`, `promo`, `system`. The KYC and maintenance tabs need their own enum values (`kyc`, `maintenance`) — server-side `Notification.type` already has these (`'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'VEHICLE' | 'SOS' | 'SYSTEM'` from use-cases.ts:121).

**Impact:** Tabs are unreliable. Riders see empty tabs because the title doesn't contain the magic word.

**Fix:** Add `kyc` and `maintenance` to the `AppNotificationType` enum. Use `n.type == AppNotificationType.kyc` directly.

**Effort:** 30 min.

---

## P2 — Cleanup backlog

### P2-1: `rider-support.use-cases.ts` (32 lines) is a parallel implementation of `support.use-cases.ts` — same methods, different ID format

The file at `rider-support.use-cases.ts` defines `riderSupportUseCases` with `createTicket`, `getTickets`, `getTicket`, `getFAQs`. The main `supportUseCases` (support.use-cases.ts) has the same methods but uses `#random` ID format vs the rider's `TICKET-{count+1}-{random}`. The route imports the main one, so the rider one is **dead code**. Delete.

### P2-2: `chat/route.ts:18-100` uses `withApiHandler` for POST but inline `try/catch` for GET

Inconsistent error handling. `GET` uses inline try/catch with `logger.error` then `errors.internal`. `POST` uses `withApiHandler` (which adds rate-limiting, logging, and uniform error responses). Pick one.

### P2-3: `supportRepository.createTicket` (data/repository_impl.dart:22-38) sends `priority: 'MEDIUM'` as default — no way to override

The Flutter side always sends `priority: 'MEDIUM'`. The web schema allows `LOW | MEDIUM | HIGH`. The rider can never raise a "HIGH" priority ticket from the app.

### P2-4: `support_checklist_screen` is shown after every successful ticket creation (create_ticket_screen.dart:65-70) — but the checklist content is hardcoded in `SupportNotifier.initSupportData`

The checklist is seeded in memory (support_provider.dart:67-71). It's the same 4 items for every rider. If the team updates the checklist, the app shows the old one. Server-driven.

### P2-5: `/api/support/tickets` GET returns `{tickets: [...]}` (route.ts:23) but the web `createTicketSchema` accepts `riderId` (validators.ts) — Flutter side never sends it correctly when the rider's session is used

The route at `tickets/route.ts:37-40` forces `riderId: body.riderId || riderDbId` — overrides the body. So the Flutter side could send any value and it's ignored. The `CreateTicketRequest` model includes `riderId` (audit #16 mentioned this) but the field is dead.

---

## Tests gap analysis

| Endpoint | Integration test? | Unit test? | Notes |
|---|---|---|---|
| `GET /api/support/faqs` | No (no test of the search → FAQ flow) | No | **GAP** |
| `POST /api/support/tickets` | Yes (`e2e/support_test.dart:25-56` — but uses **dead widget keys**) | No | **GAP** — test runs but doesn't actually assert |
| `GET /api/support/tickets` | No | No | **GAP** — the only test (`support_test.dart`) doesn't query tickets |
| `GET/POST /api/support/chat` | No | No | **GAP** — no test, no UI |
| `GET /api/rider/notifications` | Yes (`09_notifications_test.dart` + `35_kyc_notification_test.dart` + `36_offline_edge_cases_test.dart`) | No | Coverage OK for the get path |
| `PUT /api/rider/notifications` (mark read) | **No** — the `09_notifications_test.dart:30-33` taps the button but doesn't assert the server state | No | **GAP** — P0-1 is untested |
| `GET /api/search` (admin) | Tested in admin suites | No | Not rider-relevant |
| Notification create + tab filtering | No | No | **GAP** — tabs are untested |
| Photo upload on ticket creation | N/A (P0-4 — feature doesn't exist) | N/A | **GAP** — needs to be built first |

**Headline:** the `markNotificationAsRead` P0-1 bug is **not caught by any existing test** because the integration test doesn't assert the server state after a "mark all read" tap. A 1-line test (`expect(api.wasCalled('PUT', '/api/rider/notifications'))`) would catch it.

**Recommended test additions:**
1. **`e2e_individual/40_notification_mark_read_test.dart`** — login → notifications → tap mark all read → assert that the next `GET /api/rider/notifications` returns `unreadCount: 0`. **2h.**
2. **`e2e_individual/41_ticket_with_photo_test.dart`** — login → support → create ticket with attachment → assert server-side ticket has the attachment URL. **3h.**
3. **`test/features/notifications/engagement_provider_test.dart`** — mock `VoltiumApiService`, assert `markNotificationAsRead` calls `PUT` not `POST`. **1h.**
4. **`test/features/support/support_provider_test.dart`** — mock repository, assert `createTicket` passes `attachments` field. **1h.**

**Total: 7h of test work.**

---

## Recommended fix order

| # | PR | Scope | Effort | Risk | Closes |
|---|---|---|---|---|---|
| 1 | **PR-10a: Fix `markNotificationAsRead` + `markAllNotificationsRead` to use PUT** | Change `_api.post` → `_api.put` on `engagement_provider.dart:177, 188`. Add unit test. | 30min | Low | P0-1, P1-1 |
| 2 | **PR-10b: Update broken support integration tests** | Add `Key`s to `CreateTicketScreen` form fields. Update `support_test.dart` to navigate to create-ticket first. | 1h | Low | P1-6 |
| 3 | **PR-10c: Delete dead `notification_provider.dart` + test** | Remove 123 lines + dead test. | 5min | Low | P1-3, P1-7 |
| 4 | **PR-10d: Delete `/api/support/chat` (or build it properly)** | If not on roadmap, delete the route, the generated methods, the repo methods. Add 410 Gone. | 1h | Low | P0-3 |
| 5 | **PR-10e: Add photo upload to CreateTicketScreen** | Image picker → compression → upload to `/api/files/request-upload` → pass URLs to `CreateTicketRequest`. | 2-3h | Low | P0-4 |
| 6 | **PR-10f: Remove Dismissible fake-delete** | Replace `Dismissible` with "Mark as read" tap. OR add real DELETE. | 30min (remove) or 4h (add) | Low | P0-5 |
| 7 | **PR-10g: Centralize support contact details** | Move `support@voltium.in`, `+91-9876543210`, `+919876543210` to `lib/utils/placeholders.dart`. Add server endpoint for current values. | 30min-3h | Low | P1-2 |
| 8 | **PR-10h: Wire `SearchAnchor` to real FAQs** | Read from `supportProvider.faqs` instead of hardcoded list. | 2-3h | Low | P1-5 |
| 9 | **PR-10i: Fix `Future.microtask` flash in `TicketNotifier`** | Set `isLoading: true` in initial state. | 1min | Low | P1-4 |
| 10 | **PR-10j: Add KYC/Maintenance enum values** | Extend `AppNotificationType`. Update tab filters. | 30min | Low | P1-9 |
| 11 | **PR-10k: Test sprint** | Mark-read integration test + photo upload test + provider unit tests. | 7h | n/a | Tests gap |

**Total: ~3 days of focused work to close all 5 P0s and 5/9 P1s.**

---

## Architecture observations

### Two parallel notification notifiers, only one used

`EngagementNotifier` (engagement_provider.dart) and `NotificationNotifier` (notification_provider.dart) both manage notification state. Only `EngagementNotifier` is read by the UI. The other 123 lines + test are dead. Same pattern as the wallet and rental repository dead code (audits #15, #16).

### The engagement provider bypasses the generated client

`engagement_provider.dart` calls `_api.get` / `_api.post` directly with string paths and untyped bodies. The generated client at `api_client.dart:224-235` has typed methods (`getRiderNotifications`, `putRiderNotifications`). The result is a method-mismatch bug (P0-1) that the generated client would have caught at compile time.

### The "search" endpoint is a documentation bug, not a missing feature

The audit brief lists `/api/search` as a rider-accessible "Cross-entity search" endpoint. The route exists but is admin-only by design. The brief is wrong. A new feature would need a new endpoint with rider scope, not a fix to the existing one.

### The chat feature is a stub

`/api/support/chat` POST is a keyword-matcher that returns a one-line template answer. No persistence, no admin reply, no real conversation. The Flutter side has the methods but no screen. Delete or build properly — the current state is the worst of both worlds (rider thinks they chatted, no record exists).

### The FAQ list and SupportConfig are seeded client-side

`SupportNotifier.initSupportData` (support_provider.dart:61-120) seeds 3 hardcoded categories, 2 hardcoded FAQs, and a support phone/email. None of this is refreshed from the server. The `faqs` from the server are merged in via `refreshFaqs`, but the support phone/email are never updated.

### The `Dismissible` pattern is a lie

The swipe-to-delete on notifications shows a confirmation dialog and a snackbar, but only updates local state. No DELETE endpoint exists. The user thinks they deleted a notification; it comes back on app restart. Same anti-pattern as audit #9 (the dead "Delete ticket" button on the support widget).

### The `markAllRead` and `markRead` calls are fire-and-forget

`engagement_provider.dart:177, 188` call `_api.post(...)` without `await`. The method is `void` (returns `Future<void>` but the call discards it). If the API 4xx/5xxs, no error is shown to the rider. The local state was already updated optimistically. **Silent failure mode.**

### `TicketState.isLoading` starts false

`ticket_provider.dart:44-46` initializes `TicketState()` (which has `isLoading: false`). The screen reads this and shows the empty state. Then `Future.microtask` fires and sets `isLoading: true`. A 1-frame flash of empty state on every screen mount. The `wallet_provider.dart` (audit #16) had the same bug. Fix is 1 line.

### The `chat_messageSchema` accepts any string

`/api/support/chat` POST validates with `chatMessageSchema` from validators.ts. The schema only requires `message: string`. No length limit, no rate limit on the server beyond 10/min (chat/route.ts:11-13), no spam protection. A rider (or attacker with a valid session) can flood the endpoint.

---

## Out of scope for this audit

- Admin-side support ticket review (covered in `ADMIN_SUPPORT_INCIDENT_FINES_AUDIT_2026-08-05.md`).
- Notification fanout (audit #4 P0-4 — server emits them, app doesn't surface them).
- The admin notifications endpoint.
- The reward/referral methods on `EngagementNotifier` (audit #7 P0-1 noted the dashboard never reads them).
- The `engagementProvider` rewards, paymentStreak, referralData (audit #7).

---

## Cross-audit themes this audit confirms

1. **Dead code with placeholder data** — `notification_provider.dart` (this audit P1-3), `WalletRepositoryImpl` (audit #16 P0-2), `PickupEntity` (audit #17 P1-1), `RaiseTicketCard` (audit #9 P0-2). The codebase has 6+ dead feature modules.
2. **Generated client bypass** — `engagement_provider.dart` calls raw `_api.post`/`_api.get` instead of the generated `putRiderNotifications`/`getRiderNotifications` (P0-1, P1-1). The bypass pattern hides method-mismatch bugs.
3. **Hardcoded placeholder contact details** — `+91-9876543210` in `support_center_screen.dart:251` (this audit P1-2), `+919876543210` in `support_provider.dart:64` (this audit), `Rajesh Kumar (TL-01)` in pickup (audit #17 P1-3), `TEST_PHONES` in wallet (audit #16 P1-7), `support@voltium.in` / `support@voltium.app` (this audit), `+91-9876543210` in SOS (audit #12 P0-2).
4. **The "feature exists, no UI" pattern** — chat (P0-3, this audit), receipt service (audit #16 P0-1), `getRiderPricing` (audit #15 P1-3), search (P0-2, this audit).
5. **Fire-and-forget async calls on critical paths** — `markNotificationAsRead` (P0-1, this audit), `unawaited(PostHogService.identify/capture)` on auth (audit #13 P0-4), `unawaited` PostHog on toggle (audit #11 P1-3).
6. **`Future.microtask` hydration race** — `TicketNotifier` (P1-4, this audit), `ticket_provider` (audit #9 P1-3), `support_provider` (audit #9 P1-3), `EmergencyContactsNotifier` (audit #12 P1-1).

---

## Cross-audit links

- Audit #4 (Notifications admin) — server emits, app doesn't surface. This audit's P0-1 is the app-side half.
- Audit #7 (Dashboard, P0-1) — same `EngagementProvider` not refreshing.
- Audit #9 (Support) — `RaiseTicketCard` dead, `supportCenter` doesn't use the FAQ endpoint, ticket create has no photo.
- Audit #10 (Onboarding) — same hydration race in `userOnboardingProvider` (P0-1).
- Audit #12 (Emergency, P1-1) — same hydration race in `EmergencyContactsNotifier`.
- Audit #13 (Auth, P0-4) — same fire-and-forget PostHog pattern.
- Audit #14 (Auth, P0-3) — same `TEST_PHONES` placeholder pattern.
- Audit #15 (Rental, P0-2) — same dead repository pattern.
- Audit #16 (Wallet, P1-3) — same `Future.microtask` hydration race.
- Audit #17 (Pickup, P1-3) — same hardcoded team leader names.

---

**End of audit.** Recommend starting with **PR-10a (P0-1 mark-read fix, 30 min)** — one-character change, fixes a silent-failure bug that affects every rider. Follow with **PR-10b (broken test fix, 1h)** so the test suite actually validates the support flow.
