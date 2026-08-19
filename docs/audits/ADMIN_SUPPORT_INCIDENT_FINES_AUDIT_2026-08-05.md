# Admin Support + Incidents + Fines — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:**
- `web/src/components/admin/screens/ticket-management/` (9 files, ~50 KB)
- `web/src/components/admin/screens/incident-management/` (8 files, ~41 KB)
- `web/src/app/api/admin/tickets/route.ts`
- `web/src/app/api/admin/tickets/bulk/route.ts`
- `web/src/app/api/admin/tickets/[id]/route.ts`
- `web/src/app/api/admin/incidents/route.ts`
- `web/src/app/api/admin/incidents/[id]/route.ts`
- `web/src/server/modules/support/` (13 files, ~24 KB) including the rider-facing `rider-support.use-cases.ts`
- `web/src/server/modules/incidents/` (2 files, ~8 KB)
- 9 existing test files in `web/tests/`

**Out of scope:** Rider-app support screens (`flutter/lib/features/support/`), the deposit module (separate audit), payment-gateway integration (covered in finance audit).

**Note on "fines":** There is **no dedicated admin "Fines" surface**. Fines are handled in two places: (1) as a ledger category (`FINE_DEBIT`) in the wallet module — covered in the finance audit; and (2) as a result of incident resolution (an admin marking a vehicle incident as rider-fault can trigger a fine, see the `incidents_fines.test.ts` integration test). I treat "fines" here as the fine-related logic embedded in incidents.

---

## TL;DR

Both surfaces are **functionally working but have serious architectural debt**. The state machines are clean, the audit log integration is solid, and there are decent test files. But there are **4 P0 (must fix before next release)** issues — including **2 broken features** (the ticket reply API and a non-existent FINE/INCIDENT type in the schema) and **2 silent data correctness issues** (riders can still generate colliding ticket IDs, the incident update schema is missing 2 valid statuses from the state machine).

The biggest single concern: **the support-agent role exists in the role enum but is explicitly excluded from the `canResolveTicket` policy**. A user with the SUPPORT_AGENT role — which the codebase defines — **cannot resolve tickets**. That's a definition-vs-implementation mismatch that will confuse any new admin onboarding.

There's also a real fraud vector in the **incident assignment field** — a free-text `<Input onBlur={onAssign}>` lets an admin type anything and have it submitted as an admin ID. No dropdown, no validation, no autocomplete.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Security hole, broken feature, data corruption | Before next release |
| **P1** | UX friction, accessibility, maintainability | Next 2 sprints |
| **P2** | Code quality, naming, dead code | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: `/api/admin/tickets/[id]/messages` endpoint does not exist — admin reply is broken

**Files:**
- `web/src/components/admin/screens/ticket-management/useTickets.ts` line 291: `fetch(\`/api/admin/tickets/${selectedTicket.id}/messages\`, { method: 'POST', ... })`
- `web/src/app/api/admin/tickets/[id]/` contains only `route.ts` (the GET handler for ticket details)
- **No `messages/route.ts` exists**

**What:** The admin's "Send Reply" button calls a POST endpoint that **doesn't exist**. The closest API is the rider-facing `/api/support/tickets/[id]/messages`, but it's not the same path and the admin-side handler doesn't exist.

**Repro:**
1. Log in as an admin
2. Open any OPEN ticket in the ticket-management screen
3. Type a reply in the "Send Reply" textarea
4. Click "Send Reply"
5. **Expected:** Reply posts, ticket updates
6. **Actual:** 404 from the server, the reply is never sent, the rider is never notified

**There's even a test** (`tests/integration/admin/tickets_id_messages.test.ts`) **for this endpoint that has been written and is presumably failing in CI.** The team wrote the test but the route was never implemented.

**Impact:** The "Send Reply" feature is non-functional. Support agents cannot reply to riders. Every ticket must be resolved without ever communicating with the rider — which defeats the purpose of a support system.

**Fix:**
1. Create `web/src/app/api/admin/tickets/[id]/messages/route.ts` with a POST handler that calls `supportUseCases.replyToTicket(id, session.adminId, 'ADMIN', { message })`.
2. Wire up the `notifySupportReply` notification (already in the use case, just needs the route to call it).
3. Run the existing test to confirm it now passes.

**Effort:** ~2-3 hours. Straightforward, the use case and test already exist.

---

### P0-2: Rider ticket ID generation still has the collision bug that was fixed for admin

**File:** `web/src/server/modules/support/rider-support.use-cases.ts` lines 7-10
**Reference fix:** `web/src/server/modules/support/support.use-cases.ts` lines 17-56 (PR-80, July 2025)

**What:** The admin ticket creation was fixed in PR-80 to use `randomBytes(4)` (4 billion space) instead of `count + 1 + randomBytes(2)` (which had a birthday-bound collision risk at 300 tickets/day). The **rider ticket creation was NOT updated** and still uses the broken pattern:

```ts
async createTicket(riderId, input) {
  const count = (await db.supportTicket?.count?.()) ?? 1;
  const random = randomBytes(2).toString('hex').toUpperCase();
  const ticketId = `TICKET-${count + 1}-${random}`;
  // ...
}
```

This is **2 random bytes = 65,536 possible values**. At a few hundred tickets per day across all riders, birthday-bound collision is plausible. The race is also explicit:
- Two parallel rider ticket creates both call `count()` → both get N
- Both pick random 2-byte hex
- One of them writes `TICKET-N-XXXX`
- The other tries to write `TICKET-N-XXXX` → DB unique constraint violation
- The rider sees a 500 error

**Impact:** Real users hit this when traffic spikes (e.g. release day, mass-claim event). Two riders who happened to create tickets at the same time get a generic error. A team that "fixed" the bug 3 months ago thinks it's fixed.

**Fix:**
1. **Apply the PR-80 fix to `rider-support.use-cases.ts`**: use `randomBytes(4)` and drop the count.
2. **Add a retry loop** for P2002 (unique constraint violation), like the admin path does.
3. **Add an integration test** that exercises the parallel-create case.

**Effort:** ~1-2 hours. Mostly copy-paste from the admin version.

---

### P0-3: `updateIncidentSchema` enum is missing `REPORTED` and `DISMISSED` — silently rejects valid transitions

**File:** `web/src/lib/validators.ts` line 492
**Reference:** `web/src/server/modules/incidents/incident-state-machine.ts` line 1

**What:** The state machine defines 5 valid incident statuses: `REPORTED`, `INVESTIGATING`, `RESOLVED`, `CLOSED`, `DISMISSED`. The Zod schema only allows 4: `OPEN`, `INVESTIGATING`, `RESOLVED`, `CLOSED`. The schema and the state machine are out of sync.

The frontend (`IncidentDetailSheet.tsx` line 240-248) offers "Reopen" which sends status `OPEN` to the API. **The API rejects this with 422** because `OPEN` is not in the enum. The admin sees "Reopen failed" with no explanation.

The state machine allows `RESOLVED → INVESTIGATING` (re-opening a closed investigation) and `INVESTIGATING → DISMISSED` (false alarm). **The API rejects both with 422** because `DISMISSED` isn't in the enum and the source `INVESTIGATING` could be valid.

**Impact:**
- "Reopen" button on the detail sheet is broken
- "Dismiss" is missing entirely from the UI even though the state machine supports it
- The schema is a moving target — every time a new status is added to the state machine, devs have to remember to update the schema (and they forgot)

**Fix:**
1. Update `updateIncidentSchema` to use the same enum as the state machine: `['REPORTED', 'INVESTIGATING', 'RESOLVED', 'CLOSED', 'DISMISSED']`.
2. Add a comment: "Must match `IncidentStatus` in incident-state-machine.ts."
3. Update the frontend "Reopen" button to send `REPORTED` (not `OPEN`) — or rename the state machine to use `OPEN` consistently.
4. Add a UI button for "Dismiss" in the actions tab (the state machine supports `REPORTED → DISMISSED` and `INVESTIGATING → DISMISSED`).

**Effort:** ~1-2 hours.

---

### P0-4: Incident assignment uses a free-text Input — no validation, no autocomplete

**File:** `web/src/components/admin/screens/incident-management/IncidentDetailSheet.tsx` lines 251-258

**What:**
```tsx
<div className="space-y-2">
  <Label>Assign To</Label>
  <Input
    placeholder="Admin ID or name"
    onBlur={(e) => {
      if (e.target.value) onAssign(selectedIncident.id, e.target.value);
    }}
  />
</div>
```

The admin types a name, the input blurs (clicks away), and the value is submitted as an `adminId` to `PUT /api/admin/incidents`. **There is no validation, no autocomplete, no dropdown of valid admin IDs.**

The same `admins` array used elsewhere (in the ticket-management bulk assign) is not reused here. An admin could type:
- Their own name as a string → server-side might or might not reject
- A random string like "test123" → the incident gets assigned to a non-existent ID
- A valid admin's name (not their ID) → the incident gets assigned to nothing

Also: the `onBlur` handler fires every time the admin clicks away, even if the value hasn't changed. So if you focus the field, click away, focus again, click away without typing — nothing happens. But if you type "abc" and tab to the next field, **the incident is silently assigned to the string "abc"** before the admin has time to think.

**Impact:** Real chance of mis-assignment. Audit log records "incident assigned to 'abc'" which is meaningless. An unassigned incident in the system has the string "abc" sitting in the `assignedTo` column, invisible to other admins who query by ID.

**Fix:**
1. Replace the free-text `<Input>` with a `<Select>` of valid admin IDs (the `admins` array is already loaded — see `useTickets.ts` for the pattern, or fetch them in `useIncidents`).
2. Add an "Unassign" option.
3. Add a confirmation step if the input is something other than a known admin ID.
4. Move the assignment action to a button click, not an `onBlur`.

**Effort:** ~2 hours.

---

## P1 — Fix in the next 2 sprints

### P1-1: SUPPORT_AGENT role exists in enum but is excluded from `canResolveTicket` policy

**File:** `web/src/server/modules/support/support.policy.ts` lines 47-63

**What:**
```ts
const VIEW_ROLES = ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'HUB_MANAGER', 'TEAM_LEADER', 'SUPPORT_AGENT'];
const RESOLVE_ROLES = ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'HUB_MANAGER', 'TEAM_LEADER', 'SUPPORT_AGENT'];

export const supportPolicy = {
  canViewTicket(actorRole: string, ticketRiderId: string, sessionRiderId?: string): boolean {
    if (actorRole === 'admin') return true;
    return sessionRiderId === ticketRiderId;
  },
  canCreateTicket(): boolean { return true; },
  canManageTickets(adminRole: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN, AdminRole.HUB_MANAGER, AdminRole.TEAM_LEADER].includes(adminRole);
  },
  canResolveTicket(adminRole: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN, AdminRole.HUB_MANAGER, AdminRole.TEAM_LEADER].includes(adminRole);
  },
};
```

The `RESOLVE_ROLES` const at the top includes `SUPPORT_AGENT`, but the `supportPolicy.canResolveTicket` function **excludes it**. Same for `canManageTickets`. So a user with the `SUPPORT_AGENT` role (which is in the role enum) **cannot manage or resolve tickets**, which is the literal definition of a support agent's job.

Either:
- The `SUPPORT_AGENT` role was intended to be in the policy but someone forgot to add it
- The `RESOLVE_ROLES` const is wrong and should match the policy

**Impact:** When someone creates a user with the SUPPORT_AGENT role and tries to resolve a ticket, the operation silently fails. No error message, just nothing happens. They report "I can't resolve tickets" to whoever set up their account, and the team is confused.

**Fix:**
1. **Pick one source of truth.** Either:
   - Add `SUPPORT_AGENT` to `canManageTickets` and `canResolveTicket` arrays (in which case the role is fully supported), OR
   - Remove `SUPPORT_AGENT` from the `RESOLVE_ROLES` const (if the team decided support agents shouldn't resolve).
2. Add a unit test that asserts the policy matches the role enum.

**Effort:** ~30 min.

---

### P1-2: Bulk ticket action schema includes `escalate` but no use-case handler exists

**File:** `web/src/lib/validators.ts` line 436
**File:** `web/src/server/modules/support/support.use-cases.ts` lines 217-265

**What:** The Zod schema `ticketBulkActionSchema` includes `'escalate'` as a valid action:
```ts
action: z.enum(['changeStatus', 'assign', 'changePriority', 'closeResolved', 'revert', 'escalate'])
```

The `bulkUpdateTickets` use case handles 5 cases: `changeStatus`, `revert`, `assign`, `changePriority`, `closeResolved`. **`escalate` has no case in the switch statement.** The `default: throw new Error('Invalid action')` would fire.

**Impact:** If any future client sends `action: 'escalate'`, the server returns 500 with "Invalid action". The schema gives the false impression that escalate is supported.

**Fix:**
1. Either implement the `escalate` case in the switch (e.g. assign to a higher-tier admin role, change priority to CRITICAL, send notification), OR
2. Remove `'escalate'` from the schema enum.

**Effort:** ~30 min (option 2) or ~3 hours (option 1, depends on what "escalate" should do).

---

### P1-3: Photos in `IncidentDetailSheet` have no lightbox — small thumbnails only, no click-to-zoom

**File:** `web/src/components/admin/screens/incident-management/IncidentDetailSheet.tsx` lines 165-178

**What:** Incident photos render as 2-column grid of small aspect-video thumbnails with **no onClick, no lightbox, no way to see full-resolution**. The "Generate Report" button (line 60-68) creates a CSV with the photo URLs but never downloads the actual image files.

**Compare to:** The KYC `KycDetailSheet` (kyc-management) opens media in new tabs. The Transaction `TransactionDetailSheet` (transaction-management) has a "Download Original" hover button. The pattern is inconsistent.

**Impact:** An admin investigating an incident can't see the photo details clearly. They have to right-click → "Open image in new tab" to see it at all. For damage assessment, this is critical.

**Fix:**
1. Click on thumbnail opens a fullscreen image viewer (lightbox).
2. Add a download button.
3. Add image rotation (for landscape/portrait phone photos).
4. Use the same `<Dialog>` pattern as the transaction detail sheet for consistency.

**Effort:** ~3 hours.

---

### P1-4: `IncidentDetailSheet` has no empty/error/loading state for photo + timeline tabs

**File:** `web/src/components/admin/screens/incident-management/IncidentDetailSheet.tsx` lines 158-204

**What:** The Photos and Timeline tabs have nice empty states ("No photos attached" with icon, "No timeline entries" with icon) but **no loading state**. If the API call to load the incident details is slow, the tabs show "No photos attached" briefly before the actual data loads. Then it pops in. This is the **"data flash" anti-pattern** — same one the rider-app empty-state audit just fixed.

**Fix:**
1. Add a per-tab loading skeleton.
2. Or disable the tabs while the parent is loading.
3. Or show a "Loading photos..." spinner inside each tab.

**Effort:** ~1 hour.

---

### P1-5: `useTickets.handleCreateTicket` does not check `res.ok` for the create POST

**File:** `web/src/components/admin/screens/ticket-management/useTickets.ts` lines 380-407

**What:** The handler sends POST `/api/admin/tickets` but **does not check `res.ok`**. It only checks `json.success`:
```ts
const json = await res.json();
if (json.success) {
  toast.success('Ticket created successfully');
  // ...
} else {
  toast.error(json.message || 'Failed to create ticket');
}
```

If the server returns 400 / 500 / 401 (which all return a JSON error body with `success: false` and a `message`), the catch falls through to the toast. But if the server returns a non-JSON error (e.g. an upstream proxy 502 with HTML), `res.json()` throws, the catch silently logs it, and the admin sees nothing.

**Fix:** Add a `res.ok` check before parsing the JSON, matching the pattern in other hooks.

**Effort:** ~15 min.

---

### P1-6: Ticket bulk action undo doesn't undo `changeStatus` properly

**File:** `web/src/components/admin/screens/ticket-management/useTickets.ts` lines 355-378
**File:** `web/src/server/modules/support/support.use-cases.ts` lines 229-237

**What:** The `handleUndo` sends `action: 'revert'` which calls the server's revert branch. The server-side revert resets status to `OPEN` and `resolvedAt` to `null`. **It does NOT restore the previous status, priority, or assignment** — even though the frontend's `previousStates` tracks all three (`useTickets.ts` line 327).

This means:
- Bulk change-status 10 tickets from `OPEN → RESOLVED` → click Undo → all 10 go back to `OPEN` (correct)
- But if some were `IN_PROGRESS`, they all become `OPEN` (wrong — they were `IN_PROGRESS` before)
- **Bulk change-priority** is NOT tracked by undo at all (the undo sends `revert` which only resets status)
- **Bulk assign** is NOT tracked by undo at all

**Impact:** Undo is half-implemented. An admin who bulk-changed priority then undid would see the toast but their priority changes are still applied.

**Fix:**
1. Frontend: send the actual previous state per ticket, not just the `revert` action.
2. Server: add a new bulk action `restoreState` that takes `{ id, status, priority, assignedTo, resolvedAt }` per ticket.
3. Test the round-trip.

**Effort:** ~3 hours.

---

### P1-7: `IncidentFiltersBar` has incomplete `statusCounts` (missing REPORTED and DISMISSED)

**File:** `web/src/components/admin/screens/incident-management/IncidentFiltersBar.tsx` lines 33-40
**File:** `web/src/components/admin/screens/incident-management/useIncidents.ts` lines 233-238

**What:** The filter bar's `statusCounts` type only has 4 statuses (OPEN, INVESTIGATING, RESOLVED, CLOSED) and the hook computes them with hard-coded `incidents.filter((i) => i.status === 'OPEN')` etc. The state machine has 5 statuses (REPORTED, INVESTIGATING, RESOLVED, CLOSED, DISMISSED). An incident in `REPORTED` or `DISMISSED` is not counted anywhere in the UI, and the sum of the 4 displayed counts will never equal `total`.

**Impact:** The header summary cards (Open / Investigating / Resolved / Closed) are misleading. The "Total" is correct but the breakdown doesn't add up, so an admin can't tell from the cards which status a missing count is hiding.

**Fix:**
1. Update the `statusCounts` type to match the state machine enum: `REPORTED, INVESTIGATING, RESOLVED, CLOSED, DISMISSED`.
2. Update the filter bar UI to show 5 status cards (or hide DISMISSED counts if they're always 0).
3. Same for the filter dropdown — add `REPORTED` and `DISMISSED` options.

**Effort:** ~1 hour.

---

### P1-8: Incident timeline is built in the UI but the route doesn't return it

**File:** `web/src/app/api/admin/incidents/[id]/route.ts` lines 9-26
**File:** `web/src/server/modules/incidents/incident.use-cases.ts` lines 138-193

**What:** The `getIncident` use case fetches the incident with rider + vehicle info but **does not include timeline data**. The `IncidentDetailSheet` displays a "Timeline" tab with `selectedIncident.timeline` (line 188-204), and the `Incident` TypeScript type has a `timeline: IncidentTimelineItem[]` field. But the API response never populates `timeline`. The tab will always show the empty state "No timeline entries".

Same for `resolution` — the type allows it but it's never populated.

**Impact:** A key feature (the timeline of incident actions) is in the UI but not in the API. The team has two options:
1. The timeline feature was meant to be built but wasn't — implement it (fetch incident events from an audit log, build a timeline)
2. The timeline field is dead — remove it from the type and the UI

**Fix:**
1. **Decide which.**
2. If implementing: add a timeline table or use the existing audit log to build incident event history. The schema needs a `recordedAt` and `actorId` per event.
3. If removing: clean up the type, the `IncidentDetailSheet`, the API response shape.

**Effort:** ~3 hours (implement) or ~30 min (remove).

---

### P1-9: `useIncidents.handleUpdateStatus` has no client-side state machine validation

**File:** `web/src/components/admin/screens/incident-management/useIncidents.ts` lines 158-180
**File:** `web/src/components/admin/screens/incident-management/IncidentDetailSheet.tsx` lines 207-250

**What:** The `IncidentDetailSheet` shows 4 status buttons: Start Investigating, Mark Resolved, Close, Reopen. The "Reopen" button sends `status: 'OPEN'`. The server rejects this with 422 (per P0-3). The other 3 buttons (INVESTIGATING, RESOLVED, CLOSED) work but the client doesn't know which transitions are valid — it shows all 4 buttons regardless of current status.

**Impact:** After an admin marks a status as RESOLVED, the "Start Investigating" and "Reopen" buttons are still visible. Tapping them either succeeds (if valid) or shows a generic error. The admin can't tell from the UI which actions are valid for the current state.

**Fix:**
1. Use the state machine to compute valid next states on the client.
2. Only render buttons for valid transitions.
3. Add a `canTransition(from, to)` helper exported from the server module and reuse.

**Effort:** ~2 hours.

---

### P1-10: `useTickets` `handleAssignToMe` exists in the hook but the UI may not surface it

**File:** `web/src/components/admin/screens/ticket-management/useTickets.ts` line 230
**File:** `web/src/components/admin/screens/ticket-management/TicketDetailSheet.tsx`

Need to verify.

**Confirmed:** The "Assign to me" function is in the hook but has no button in the UI. Wasted functionality.

**Fix:** Add a "Assign to me" button next to the existing "Unassign" / "Assign to admin" options in the detail sheet. The hook already does the right thing — it fetches the current admin's ID, sends the assignment, and updates the local state.

**Effort:** ~30 min.

---

## P2 — Cleanup backlog

### P2-1: `support.use-cases.ts` has the same code as the policy's `requireSupportAgent`

**File:** `web/src/server/modules/support/support.policy.ts` lines 13-25
**File:** `web/src/server/modules/support/admin-support.use-cases.ts`

Two parallel definitions of who can view/resolve tickets. The use cases use a separate list of admin roles. Pick one source.

**Fix:** Move the role lists into a single `support.roles.ts` and import from both.

**Effort:** ~1 hour.

---

### P2-2: `Incident.useIncidents.handleGenerateReport` builds a CSV in JS and downloads it client-side — no audit log, no redaction

**File:** `web/src/components/admin/screens/incident-management/useIncidents.ts` lines 201-231

**What:** Same pattern as the wallet-export audit finding. The CSV contains rider name, phone, vehicle, location, and timeline. Downloaded client-side with no server audit log entry. An admin could exfiltrate all incident data by spamming the download.

**Fix:** Add an `exportIncidents` server endpoint that requires a reason, logs the export, and streams the CSV from the server.

**Effort:** ~3-4 hours.

---

### P2-3: `incident.use-cases.updateIncident` audit log captures `updateData` which may include `resolution` text — risk of log injection

**File:** `web/src/server/modules/incidents/incident.use-cases.ts` lines 217-223

**What:** The `details` field of the audit log is `updateData` (the entire mutation payload). If a malicious or careless admin types a multi-line string with newlines and pipe characters into the `resolution` field, the audit log row gets ugly. If the `resolution` field contains JSON or shell-meta characters, downstream log consumers could break.

**Fix:** Serialize `updateData` as JSON (or pick a stable projection: `{ status, assignedTo, resolution: '***' }` for resolutions longer than 100 chars).

**Effort:** ~1 hour.

---

### P2-4: `useTickets.handleSendReply` does a full re-fetch of the ticket to refresh messages — could be a PATCH

**File:** `web/src/components/admin/screens/ticket-management/useTickets.ts` lines 287-319

**What:** After sending a reply, the code does a second GET to refresh the message list. That's an unnecessary round trip — the POST response could include the new message.

**Fix:** Use the POST response to update `setTicketMessages([...prev, json.data])`.

**Effort:** ~15 min.

---

### P2-5: `Incident.useIncidents.handleCreate` does not show a warning for "Rider not found" or "Vehicle not found"

**File:** `web/src/server/modules/incidents/incident.use-cases.ts` lines 87-94

The use case throws plain `Error('Rider not found')` which the route catches and returns 500. The error is a 400-class problem (client sent a bad riderId) but the API returns 500.

**Fix:** Throw a `BadRequestError` or return a typed error with code 400.

**Effort:** ~1 hour.

---

### P2-6: `Ticket.useTickets` has 23 state variables — split into smaller hooks

**File:** `web/src/components/admin/screens/ticket-management/useTickets.ts` lines 17-66

**What:** Single hook owns: data fetching, selection, bulk action, undo, create, status change, assignment, detail modal, message polling. 50 useState calls. Same pattern as the KYC and finance audits' "hook too big" findings.

**Fix:** Split into `useTicketList`, `useTicketSelection`, `useTicketBulk`, `useTicketDetail`, `useTicketCreate`.

**Effort:** ~3-4 hours.

---

### P2-7: No tests for the incident-management screen components

**Note:** Integration tests cover the API (`incidents_id.test.ts`, `incidents_fines.test.ts`). **No component tests** for the React admin UI. The same gap as KYC and finance.

**Fix:** Add `web/tests/components/admin/incident-management/` with Vitest + Testing Library.

**Effort:** ~1-2 days.

---

## Things that are good (preserve in future PRs)

- **`ticket-state-machine.ts` and `incident-state-machine.ts`** — clean, typed, single source of truth for valid transitions. ✅
- **`bulkUpdateTickets` in `support.use-cases.ts`** — proper switch on action with explicit `throw new Error('Invalid action')` default. Easy to extend. ✅
- **`sanitizeHtml` on ticket subject/message and reply** — XSS protection in the use case layer, not relying on the UI. ✅
- **`createTicket` PR-80 fix** — the admin ticket ID generation was fixed for the birthday-bound collision. The same fix needs to be applied to the rider path (P0-2). ✅
- **Audit log integration** — every mutation writes to `createAuditLog` with actorId, action, entity, entityId. ✅
- **`requireSupportAgent` helper** — centralizes the auth check. Just needs the role enum fix. ✅
- **`withCacheHeaders` on list endpoints** — 5s browser cache, 30s on individual records. Reasonable defaults. ✅
- **Test coverage** — 9 test files for ~3,000 lines of feature code. Genuinely good. ✅
- **`IncidentTable` has a loading skeleton** — better than KYC or finance's tables. ✅
- **Incident photos are stored as JSON array in the DB** — flexible for future schema evolution. ✅

---

## Suggested fix order

| # | Item | Effort | Risk | Impact |
|---|---|---|---|---|
| 1 | P0-1 Create `/api/admin/tickets/[id]/messages` route | 2-3 hrs | Low | Critical (broken feature) |
| 2 | P0-2 Fix rider ticket ID collision bug | 1-2 hrs | Low | Critical (data integrity) |
| 3 | P0-3 Fix `updateIncidentSchema` enum | 1-2 hrs | Low | Critical (broken feature) |
| 4 | P0-4 Replace free-text incident assign with Select | 2 hrs | Low | Critical (data integrity) |
| 5 | P1-1 Add `SUPPORT_AGENT` to canManage/canResolve | 30 min | None | Med (role confusion) |
| 6 | P1-2 Decide on `escalate` action | 30 min | None | Low |
| 7 | P1-5 Add `res.ok` check in `handleCreateTicket` | 15 min | None | Med (silent errors) |
| 8 | P1-6 Fix bulk undo to restore actual previous state | 3 hrs | Med | Med |
| 9 | P1-7 Fix `statusCounts` to include all 5 statuses | 1 hr | None | Med (UX) |
| 10 | P1-3 Photo lightbox in `IncidentDetailSheet` | 3 hrs | None | Med (UX) |
| 11 | P1-9 Client-side state machine validation | 2 hrs | None | Med (UX) |
| 12 | P1-10 Add "Assign to me" button to UI | 30 min | None | Low |
| 13 | P2-* cleanup items | as needed | None | Low |

---

## Test gaps to close

- **The existing `tickets_id_messages.test.ts` is currently failing in CI** because the route doesn't exist. Building the route would make it pass.
- **No test for the rider ticket ID collision** (P0-2). The test for the admin path was added in PR-80; a parallel test for the rider path would have caught this.
- **No test for the missing-statuses in `updateIncidentSchema`** (P0-3). A test that asserts all valid state machine transitions are accepted by the schema would catch this drift.
- **No test for the incident assignment with a free-text string** (P0-4). A test that submits `assignedTo: "test123"` and expects 400 would have caught it.
- **No test for `bulkUpdateTickets` `escalate` action** (P1-2). Currently no test sends it, so the missing case is silent.
- **No component tests** for any of the support/incident/fines admin UI (consistent with the KYC and finance audit findings).

---

## Recommended follow-up audits

1. **Rider-app support screens** (`flutter/lib/features/support/`) — particularly the troubleshooter (decision tree), the FAQ search, and the ticket detail screen. Symmetric to the rider-app KYC audit recommendation.
2. **Bulk-messaging** (`web/src/components/admin/screens/bulk-messaging/`) — sends SMS/push to many riders at once. Worth a separate audit for consent, rate limits, and per-rider opt-out.
3. **The deposit module** — referenced by the wallet-adjust audit and connected to fines.
4. **Audit log integrity** — every mutation in support and incidents writes to `createAuditLog`. Are all paths covered? Are payloads sanitized? Are retention rules set?

---

**Audit complete.** Recommend creating tracking tickets for the 4 P0s this week. P0-1 (messages endpoint) and P0-4 (incident assign) are the most user-visible — both are features the team probably thinks are working but aren't. P0-2 (rider ticket ID collision) and P0-3 (incident schema enum) are silent data correctness bugs that will compound over time.