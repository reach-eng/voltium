# Admin Configuration + Server Health + System Settings — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:**
- **Configuration** — `web/src/components/admin/screens/SettingsManagement.tsx` (h2 = "Configuration") with three tabs:
  - **Business Settings** — `web/src/components/admin/screens/settings/` (8 files, ~13 KB) + `web/src/app/api/admin/settings/route.ts` + `web/src/server/modules/settings/setting.use-cases.ts` + `web/src/server/modules/settings/settings.registry.ts`
  - **Feature Flags** — `web/src/components/admin/screens/FeatureFlagsScreen.tsx` + `web/src/app/api/admin/feature-flags/route.ts` + `web/src/lib/feature-flags.ts`
  - **Maintenance Mode** — `web/src/components/admin/screens/MaintenanceModeScreen.tsx` + `web/src/app/api/admin/maintenance-mode/route.ts`
- **Server Health** — `web/src/components/admin/screens/server-health/` (7 files, ~9 KB) + `web/src/app/api/health/{route.ts, db/route.ts, storage/route.ts, worker/route.ts}`
- **System Settings** — `web/src/components/admin/screens/SystemSettingsScreen.tsx` + `web/src/components/admin/screens/system-settings/` (8 files, ~10 KB) + `web/src/app/api/admin/system-settings/route.ts` + `web/src/lib/validators/admin.ts` (the `updateSystemSettingSchema`)
- Existing tests: `web/tests/integration/admin/feature_flags.test.ts` (looks at the route), no tests for settings, system-settings, maintenance-mode, or any of the four `/api/health/*` endpoints

**Out of scope:** Backup / restore flows (data-management), the FCM + admin-notification flows (covered in the messaging audit), rider-app interactions with the maintenance banner, the audit-logs module.

---

## TL;DR

**The most important surface — Maintenance Mode — is a UI with no enforcement behind it.** The admin toggles "Enable Maintenance", the toast says "Maintenance mode enabled successfully", the row in `SystemSetting` flips to `value = 'true'` — and then **riders keep booking rentals, completing KYC, paying, and messaging support as if nothing happened.** A `grep -r "MAINTENANCE_MODE" web/src/middleware.ts web/src/lib/api-middleware.ts web/src/app/api/rider/` returns zero matches. The setting is read by exactly two pieces of code: the `scheduled-backup.job.ts` (which skips a backup if maintenance is on) and `data-management` use-cases (which refuse to start a backup if maintenance is on). The "pause rider operations during server upgrades" promise is broken.

The second-biggest issue is in **Business Settings** — there is a working PUT to `/api/admin/settings` that writes to `db.systemSetting`, but **the route invalidates the cache with the pattern `admin:*` (everything)** which throws away every cached admin response across the entire app on every save. For a system that uses response caching for every admin list, this is heavy-handed.

The third is the **Server Health page has a hardcoded `caddyStatus: 'Active'`** that is never checked against a real endpoint. The "Caddy Reverse Proxy: ACTIVE" green badge is decorative, not diagnostic.

The fourth is the **System Settings page is gated client-side on `adminRole === 'SUPER_ADMIN'`** but the PUT route gates on `settings_manage` (a permission that multiple roles have). A non-SUPER_ADMIN with `settings_manage` (or a curl with a valid admin session) can bypass the UI lock.

There are **3 P0s**, **7 P1s**, and **6 P2s**. The three sections are otherwise well-structured — clean code splits (R3.7d, R3.7i, R3.7k), good skeleton + error states, and tight role-based access on most endpoints. The maintenance-mode gap is the headline.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Security hole, broken feature, silent data corruption | Before next release |
| **P1** | UX friction, accessibility, performance, misleading data, missing enforcement | Next 2 sprints |
| **P2** | Code quality, naming, dead code, console warnings | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: Maintenance Mode does not block rider traffic — the UI is a placebo

**Files:**
- `web/src/app/api/admin/maintenance-mode/route.ts` lines 59–86: the PUT handler writes `MAINTENANCE_MODE = 'true'` to `SystemSetting` (line 62, 74)
- `web/src/components/admin/screens/MaintenanceModeScreen.tsx` lines 43–64: the UI toggle that calls the PUT
- `web/src/middleware.ts` — full file (207 lines) does **not** check `MAINTENANCE_MODE` anywhere
- `web/src/lib/api-middleware.ts` — full file (164 lines) does **not** check `MAINTENANCE_MODE` anywhere
- `web/src/app/api/rider/**` — `grep -r MAINTENANCE web/src/app/api/rider` returns zero matches
- `flutter/lib/**` — `grep -r maintenance web/src/lib/flutter` returns zero matches in the rider app

**What:** The Configuration → Maintenance Mode tab presents a card with a "Disable/Enable Maintenance" button. The button writes a row to `SystemSetting(key: 'MAINTENANCE_MODE', value: 'true')` and shows a green "Maintenance mode enabled successfully" toast. The card description says: *"When enabled, riders will be blocked from API operations with a maintenance message."* **The actual code never checks `MAINTENANCE_MODE` on any rider-facing or admin-facing request path.** A `grep` for `MAINTENANCE_MODE` across the entire web/src/ tree finds only three consumers:

1. `web/src/server/workers/jobs/scheduled-backup.job.ts:28-31` — **skips the backup job** if maintenance is on (so backups don't run during a maintenance window — good).
2. `web/src/server/modules/data-management/data-management.use-cases.ts:338-341` — **refuses to start a manual backup** if maintenance is on (a guard, also good).
3. `web/src/server/modules/data-management/restore.service.ts:30-33` — **sets MAINTENANCE_MODE = true before a disaster-recovery restore** (an internal workflow hook, not enforcement).

**None of the middleware, no API route, no auth check, and no Flutter call site reads `MAINTENANCE_MODE`.** A rider can complete KYC, book a lease, top up wallet, send a support ticket, or any other operation while the admin's screen says "Maintenance mode is enabled."

**Repro:**
1. Log in as admin → Configuration → Maintenance Mode
2. Click "Enable Maintenance"
3. Confirm toast: "Maintenance mode enabled successfully"
4. The card now shows the amber "Maintenance mode is active" state with the banner message
5. In a separate incognito window, log in as a rider
6. Open the rider app, navigate to a rental screen, attempt to book a rental
7. **Expected (per UI copy):** The rider sees the maintenance banner and is blocked
8. **Actual:** The rental books successfully, no banner appears, the rider has no indication the system is in maintenance

**Impact:** This is the primary disaster-recovery / upgrade-time feature. The DR runbook (referenced in the maintenance card's "Pre-requisite" amber box: *"Maintenance mode should be active before running any disaster recovery restores"*) explicitly tells the operator to enable maintenance before a restore. If they do, nothing changes. If they believe the UI and proceed with the restore thinking rider traffic is blocked, riders are creating transactions on a database that is being overwritten by the restore. **The data-loss potential is real.**

Also: the "Admin users retain read/write access to the dashboard during maintenance" line in the Pre-requisite card is also a UI-only statement — there's no code that exempts admin sessions from the maintenance check, because there's no code that checks maintenance at all.

**Fix:**
1. **Add a maintenance check to the request pipeline.** The cleanest place is the `middleware.ts` — after the auth/CORS handling but before `NextResponse.next()`, query `db.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MODE' } })` and if `value === 'true'`, return `503` with the maintenance message for any non-admin `/api/rider/*` and `/api/auth/*` (allow login/OTP so the rider can at least see the message). The admin session can be detected by the `ADMIN_SESSION_COOKIE_NAME` cookie.
2. **Add a rider-app endpoint** `/api/rider/maintenance-status` (or include it in the public config) so the Flutter app can show the banner on launch. The admin should be able to see the same message in the rider app, with a CTA to retry later.
3. **Cache the result** for 5–10s in-process to avoid a DB hit per request.
4. **Update the DR runbook** to verify the maintenance check is in place before the next restore drill.

**Effort:** ~3–4 hours. ~30 lines of middleware code + the cache + a Flutter banner.

---

### P0-2: `caddyStatus` on Server Health is a hardcoded string — the green ACTIVE badge is decorative

**File:** `web/src/components/admin/screens/server-health/useServerHealth.ts` line 78: `caddyStatus: 'Active'`.
**File:** `web/src/components/admin/screens/server-health/ServicesDaemonsCard.tsx` lines 56–58: the Caddy row with a hardcoded `<Badge className="bg-emerald-600 text-white">ACTIVE</Badge>`.

**What:** Three of the four services on the Server Health card are probed live (PostgreSQL via `/api/health/db`, PM2 outbox via `/api/health/worker`, storage via `/api/health/storage`). The fourth, **Caddy Reverse Proxy**, is hardcoded to `'ACTIVE'` in the data hook. The Caddy badge is always green. The admin has no way to know from this page whether the reverse proxy is actually running, whether the SSL cert is valid, or whether the upstream Caddy process is down.

This is a quiet lie. The page presents itself as a real-time health check. An operator who glances at "PostgreSQL RUNNING, PM2 ONLINE, Caddy ACTIVE" and goes home for the night has no signal that the Caddy process crashed at 6pm and is serving 502s to all production traffic.

**Fix:**
1. Either add a real probe — a `HEAD /api/health/caddy` that pings a Caddy-known endpoint (the local `http://localhost:2019/config/` JSON API on a default Caddy install, or a 200 from `https://api.voltium.app/`) — and wire it into the existing 4-way `Promise.all`.
2. Or remove the Caddy row from the card entirely (better: move it to a "Reverse proxy: not monitored from this page" line in the read-only status grid under System Settings) and let the operator rely on external uptime monitoring (UptimeRobot, etc.) for the proxy.

**Effort:** ~1 hour for the probe (Caddy exposes a local admin API on `:2019` by default; can also use the production HTTPS probe). Or ~10 min to remove the row.

---

### P0-3: Business Settings PUT invalidates **every** cached admin response — `admin:*` is a shotgun

**File:** `web/src/app/api/admin/settings/route.ts` line 38: `invalidateCache('admin:*');` (after every successful PUT).

**What:** The `invalidateCache` helper deletes every cache key matching the pattern. `admin:*` matches every cached admin response across the entire app — riders lists, KYC lists, transactions, vehicles, offers, KYC breakdowns, support tickets, everything. On every successful save of a single business setting (e.g. changing "Referral Bonus" from 500 to 600), every admin list page in the system throws away its cache and re-fetches the DB on the next request.

```ts
// settings/route.ts:38
invalidateCache('admin:*');
return success(results, 'Settings updated');
```

For a single-user, low-traffic local_laptop deployment this is wasteful but not catastrophic. For a multi-admin SaaS deployment this is a thundering herd problem: 50 admins all simultaneously open the riders list right after one admin saves a setting, and all 50 hit the DB at once because the cache is empty.

**Impact:**
- **Latency spike** on the first page load after every settings save (e.g. 50 concurrent DB queries instead of 50 served-from-cache).
- **DB load spike** — could trigger connection pool exhaustion if Prisma is configured with a small pool (the codebase uses Prisma per `agent-context`).
- **Confusing for the team** — the same `admin:*` pattern is used by other invalidation sites (line 47 of `feature-flags/route.ts` is correctly scoped to `admin:feature-flags:*`); the settings route is the outlier that nukes everything.

**Fix:** Scope the invalidation to the specific cache keys the settings change affects. For example, the wallet / referral / late-fee settings affect pricing, payments, and wallet-balance responses; the notification toggles affect notification delivery; the policy settings (auto-approve KYC, grace period) affect KYC + rental flow responses. A reasonable scope:

```ts
// Invalidate only what business settings actually affect
invalidateCache('admin:riders:*');           // for maxWalletBalance, loyaltyPointsPerRupee
invalidateCache('admin:wallet:*');           // for walletMinTopup, lateFee
invalidateCache('admin:referrals:*');        // for referralBonus
invalidateCache('admin:kyc:*');              // for autoApproveKYC
invalidateCache('admin:rentals:*');          // for maxRentalDays, penaltyCapDays
invalidateCache('admin:public-settings:*'); // for any isPublic setting
```

Or, even simpler: invalidate `admin:settings:*` and `public:*` (the rider-facing public settings endpoint), and let the next page load re-populate lazily.

**Effort:** ~30 min to identify which cache keys each setting affects and replace the wildcard.

---

## P1 — Next 2 sprints

### P1-1: System Settings UI is gated on `isSuperAdmin` (client-side) but the route allows any `settings_manage` role
**File:** `web/src/components/admin/screens/system-settings/useSystemSettings.ts` line 85: `const isSuperAdmin = adminRole === 'SUPER_ADMIN';` — and the row's Save button is `disabled={!isSuperAdmin}` (SettingRow.tsx:82).
**File:** `web/src/app/api/admin/system-settings/route.ts` line 87: `if (!hasPermission(session, 'settings_manage')) return errors.forbidden(...)`.

**What:** The hook disables every Save button unless the current admin's role is `SUPER_ADMIN`. The route allows any role that has `settings_manage` (which is shared by SUPER_ADMIN, OPERATIONS_ADMIN, and possibly others — see `permissions-roles.ts`). The mismatch means:

- A `KYC_REVIEWER` or `FINANCE_ADMIN` who happens to have `settings_manage` (or has it custom-injected into their session) **sees disabled buttons in the UI but can successfully save by curling the API.** This is a confusing failure mode and an indirect privilege escalation.
- A `SUPER_ADMIN` who somehow doesn't have `settings_manage` (theoretically possible if the matrix changes) sees enabled buttons but gets 403 from the server.

**Fix:** Pick one and stick to it. Recommend: **align the route to the UI's stricter rule** — replace the `settings_manage` check with `session.adminRole === 'SUPER_ADMIN'`. This makes the rule "only super-admins can edit system settings" consistent across UI and API. Add an `isSuperAdmin`-equivalent check to the GET as well if the read should be restricted (probably not — the read is harmless).

**Effort:** ~10 min.

---

### P1-2: Server Health card has no Caddy row but the page label and the suite-level "cpu" field are mislabelled
**File:** `web/src/components/admin/screens/server-health/HardwareMetricsCard.tsx` lines 27–34: `CPU Utilization` displays `health.cpuUsage` and `RAM Usage` displays `health.ramUsage`.

**What:** Looking at the data hook (useServerHealth.ts:69-72), `cpuUsage` is set to `\`${usagePercent}% (Disk Usage)\`` — it's actually the **disk usage percent**, not CPU. The label says "CPU Utilization" but the value is disk%. An admin reading the page sees "CPU: 14%" when actually that's "Disk: 14%".

```ts
// useServerHealth.ts:69
cpuUsage: usagePercent ? `${usagePercent}% (Disk Usage)` : 'Disk Metrics unavailable',
```

This is a copy-paste bug from when the page was being developed — the developer named the variable `cpuUsage` but the value is from `general.checks.disk.usagePercent`. The literal string `(Disk Usage)` in the value is the only thing that hints at the truth, but it's right next to the actual disk field (line 38: `freeDiskGb`), so the redundancy is not caught by eyeball QA.

**Fix:** Either (a) actually read CPU usage via `os.cpus()` from `node:os` and report it correctly, or (b) rename the field to `diskUsage` and update the label to match. (a) is the right fix because the field name and label are also there in `types.ts:23-24` and the `Card.tsx:28-29` reference — the whole "Hardware Metrics" card is mislabelled.

Also: `ramUsage` actually shows **uptime in minutes** (line 70-72: `ramUsage: general?.checks?.uptime?.seconds ? \`Uptime: ...\` : ...`). The label says "RAM Usage" but the value is uptime. Same kind of bug.

**Effort:** ~1 hour to do it properly (use `os.cpus()` for CPU, `process.memoryUsage()` for RAM, both work in serverless only if the runtime supports it; alternatively, remove the RAM row and rename the existing rows to match what's actually shown).

---

### P1-3: Server Health `useServerHealth.fetchHealth` reads from 4 separate endpoints instead of one — N+1 style overhead
**File:** `web/src/components/admin/screens/server-health/useServerHealth.ts` lines 22–27: `Promise.all([fetch('/api/health'), fetch('/api/health/db'), fetch('/api/health/storage'), fetch('/api/health/worker')])`.

**What:** The Server Health page makes **4 parallel HTTP requests** to the same origin, each probing a different aspect. The combined response payload is ~3 KB, the combined latency is `max(t1, t2, t3, t4) + parse × 4`. The full `GET /api/health?detailed=true` endpoint already returns database status, disk, upload path, backup path, and uptime in one round-trip.

```ts
// /api/health/route.ts supports a `detailed=true` query param
if (!detailed) {
  body.checks = { database: { status }, disk: { status }, ... };
}
// detailed=true returns full checks
```

The data hook ignores the `detailed=true` mode of `/api/health` and instead fans out to the three sub-endpoints. This is N+1 in the small — 4 requests for what could be 1. The sub-endpoints are still useful for granular checks (e.g. the worker outbox), but the parent `/api/health` is sufficient for the page-level summary.

**Fix:** Make the data hook call `GET /api/health?detailed=true` for the parent and only fan out to the worker endpoint for the outbox stats (since `/api/health` doesn't include the outbox status). Result: 2 requests instead of 4, with one of them being a single round-trip that includes most of the data the cards render.

**Effort:** ~20 min.

---

### P1-4: `MaintenanceModeScreen` allows editing the banner message while maintenance is disabled — and disables the field while enabled
**File:** `web/src/components/admin/screens/MaintenanceModeScreen.tsx` lines 130–140: the message input has `disabled={enabled}` and the Save button has `disabled={saving || enabled}`.

**What:** The form is wired backwards:
- When `enabled = false`: the message input is **enabled** and the Save button is **enabled**. The admin can save a message that is never shown to anyone (because no rider-facing code reads the message — see P0-1).
- When `enabled = true`: the message input is **disabled** and the Save button is **disabled**. The admin cannot update the message while a maintenance window is in progress.

This is a guess at the original intent — "let the admin prepare the message before turning on maintenance" — but it makes the edit-then-enable flow the only way to set a message, and disables corrections mid-window. With P0-1 fixed (enforcement wired up), this becomes a more meaningful workflow.

**Fix:** Always-enabled input + Save button. The "Enable Maintenance" button toggles the runtime state, the message is a separate field. Removing the `disabled={enabled}` constraint on both the input and the save button.

**Effort:** ~10 min.

---

### P1-5: `useSystemSettings` swallows 401s on `/api/admin/system-settings` — the admin sees a misleading "Could not load system settings"
**File:** `web/src/components/admin/screens/system-settings/useSystemSettings.ts` lines 36–50.

**What:** If the session expires (or the cookie is missing), the GET returns 401. The hook logs "Failed to load system settings" via a toast. The right behaviour is to redirect to the login page (the session is gone, no amount of retry will help).

```ts
if (res.ok) {
  // ... happy path
} else {
  toast.error('Failed to load system settings');  // <-- misleading on 401
}
```

A 401 should redirect, a 403 should show the "Super Admin required" banner, a 500 should show the existing toast.

**Fix:** Branch on `res.status`:
- `401` → call the auth refresh endpoint; if refresh fails, redirect to `/admin/login`.
- `403` → set a state flag that the orchestrator can read to render the `RoleLockBanner`.
- `500+` → keep the existing toast.

**Effort:** ~15 min.

---

### P1-6: Business Settings — 4 settings in the card UI are not in the registry and silently fail to save
**File:** `web/src/components/admin/screens/settings/settingsTypes.ts` lines 18–22: `Settings` interface includes `maxRentalDays`, `penaltyCapDays`, `maxWalletBalance`, `loyaltyPointsPerRupee` — none of which are in `SETTING_REGISTRY` (`web/src/server/modules/settings/settings.registry.ts:16-81`).
**File:** `web/src/lib/validators/admin.ts` line 201–209: `ADMIN_SETTING_KEYS` does **not** include these 4 keys.

**What:** The Business Settings tab shows 5 cards. The first 3 (Pricing, Automation, Notifications) are wired to keys that are in the registry. The 4th card (`LimitsPoliciesCard.tsx`) and 5th card (`SupportContactCard`) reference 6 fields. Of those 6:
- `supportEmail` and `supportPhone` (SupportContactCard) — not in the registry either, the validator rejects them with 422.
- `maxRentalDays`, `penaltyCapDays`, `maxWalletBalance`, `loyaltyPointsPerRupee` (LimitsPoliciesCard) — not in the registry, rejected with 422.

**So the "Save Changes" button works only for 8 out of 14 fields.** When the admin fills in the Support Email + Phone + Max Rental Days, clicks Save, the server returns 422 and the admin sees "Failed to save settings" with no indication which field failed. The toast text from `useSettings.ts:54` is generic.

**Repro:**
1. Log in as admin → Configuration → Business Settings
2. Type a new "Support Email" — e.g. `help@voltium.io`
3. Type a new "Max Rental Days" — e.g. `45`
4. Click "Save Changes"
5. The toast says "Failed to save settings"
6. The settings are NOT saved (the validator rejected the unknown key)
7. The Pricing card values (which are valid) are also NOT saved (the validator runs on the whole object, returns on the first failure)

This is a P1 because the UI shows fields that don't work. It looks like a half-finished feature: the cards exist, the inputs work, the Save button is there, but the server doesn't accept 6 of the 14 fields. An admin who only ever edits the Pricing tab thinks everything is fine; an admin who touches Support Contact or Limits discovers it silently drops their change.

**Fix:**
1. Add the missing 6 keys to `SETTING_REGISTRY` in `settings.registry.ts` with appropriate `category` and `valueType`:
   - `maxRentalDays`: NUMBER, POLICY, `isPublic: true`
   - `penaltyCapDays`: NUMBER, POLICY, `isPublic: true`
   - `maxWalletBalance`: NUMBER (paise), BUSINESS, `isPublic: true`
   - `loyaltyPointsPerRupee`: NUMBER, POLICY, `isPublic: true`
   - `supportEmail`: STRING, NOTIFICATION, `isPublic: true`
   - `supportPhone`: STRING, NOTIFICATION, `isPublic: true`
2. Add the same 6 keys to `ADMIN_SETTING_KEYS` in `validators/admin.ts`.
3. Add a meaningful error to the toast — include the validator's error message in the failure path (`useSettings.ts:54-55`).
4. The pricing card's `walletMinTopup / lateFee / referralBonus` are in the registry but the values coming from the API are already paise-converted in the use case (`setting.use-cases.ts:24-26`). The Save path then converts the rupees to paise again at the registry (`settings.registry.ts:139`). **This is correct**, but it's load-bearing — if anyone ever removes the multiplication, the values get stored as rupees and the system starts charging 100× more. Add a comment in both places cross-referencing each other.

**Effort:** ~1 hour to add the registry entries + validator update + test + toast improvement.

---

### P1-7: Feature Flags list silently drops flags that aren't in the static `FLAG_LABELS` / `FLAG_DESCRIPTIONS` map
**File:** `web/src/components/admin/screens/FeatureFlagsScreen.tsx` lines 17–28 (the hardcoded maps) and lines 177–199 (the rendering loop).

**What:** The screen iterates `Object.entries(flags)` and renders one row per flag. The label and description come from hardcoded maps keyed by the flag name (`enableReferralSystem`, `enableRewardsSystem`, etc.). If `getAllFeatureFlags` ever returns a flag that isn't in the map, the row renders with the raw flag name as the label and an empty description:

```ts
<span className="font-medium">{FLAG_LABELS[key] || key}</span>
...
<p className="text-sm text-muted-foreground mt-1">{FLAG_DESCRIPTIONS[key] || ''}</p>
```

The `defaultFlags` object in `web/src/lib/feature-flags.ts:17-28` is the source of truth — if a future feature adds a new flag to `defaultFlags` but forgets to update the screen maps, the new flag shows up in the API response but renders as a key-name-only row on the page. Worse: the `maxUploadSizeMb` flag is special-cased via `const isBoolean = key !== 'maxUploadSizeMb';` (line 178) — any new numeric flag would render as a Switch toggle by default.

**Fix:**
1. Move `FLAG_LABELS` and `FLAG_DESCRIPTIONS` into `web/src/lib/feature-flags.ts` (or a sibling file) as the canonical metadata for the flags.
2. Have `getAllFeatureFlags` include the label/description in the response (or a new `getFeatureFlagMetadata()` function), and the screen consumes them. Single source of truth.

**Effort:** ~1 hour.

---

## P2 — Cleanup backlog

### P2-1: `useSettings.isDirty` uses `JSON.stringify` comparison on every render
**File:** `web/src/components/admin/screens/settings/useSettings.ts` line 71: `const isDirty = JSON.stringify(settings) !== JSON.stringify(initial);`.

Both `settings` and `initial` change on every `updateSetting` / `updateBool` call. The `JSON.stringify` runs on every render of the screen (and the Save bar). For 14 fields with 2–6 char values this is fine, but for 50 settings it's a perf tax. Replace with a shallow per-key compare or a `useMemo` that depends on `settings`.

### P2-2: `Server Health` page returns the parent `/api/health` 200 even when the disk check is degraded — no surface signal
**File:** `web/src/app/api/health/route.ts` lines 158–162.

`status: 'degraded'` returns HTTP 200, not 503. The cards show the degraded state, but external uptime checks that ping `/api/health` will see "all green." Decide: degraded = 200 (current — useful for "page is up, just slow") or 503 (useful for "operator should investigate now"). Document the choice in the route.

### P2-3: `getServerHealth.useServerHealth` hardcodes `freeGb` defaults of 128 and `totalGb` of 512
**File:** `web/src/components/admin/screens/server-health/useServerHealth.ts` lines 35–39.

If the `/api/health` response is missing or stale, the cards silently show "128 GB free of 512 GB" instead of "—". For a server with 256 GB disk this is wrong. Recommend showing `—` and a warning banner ("Disk metrics unavailable — server may be unreachable") rather than fake numbers.

### P2-4: `SystemSettingsHeader` shows the "Super Admin" pill in the top-right but the page can also be in view-only mode for non-SUPER_ADMIN
**File:** `web/src/components/admin/screens/system-settings/SystemSettingsHeader.tsx` lines 25–29.

The pill is shown **only** when `isSuperAdmin` is true. For a non-SUPER_ADMIN, the header has no role indicator. The `RoleLockBanner` shows below the header, but the header should also make the role explicit ("Logged in as Operations Admin" subtitle) to give context.

### P2-5: `SettingRow`'s `inputValue` displays `'[CONFIGURED]'` as a placeholder for secret settings — but the `<Input value="[CONFIGURED]">` makes it a real value the user can edit
**File:** `web/src/components/admin/screens/system-settings/SettingRow.tsx` line 50: `const inputValue = setting.isSecret && !showSecret ? '[CONFIGURED]' : (value ?? '');`.

This is intentional (the route guard at line 110 of `system-settings/route.ts` skips the write if the value is `[CONFIGURED]`), but the UX is brittle: a user who clicks into the input, types a character, then realises they don't want to change it, and presses Escape — the typed character is now in the input, the value is no longer `[CONFIGURED]`, and the next Save will overwrite the secret. The Eye toggle + a clear "Cancel" button is the right pattern.

### P2-6: Business Settings — the "Settings updated" success message from the API is not surfaced to the admin
**File:** `web/src/components/admin/screens/settings/useSettings.ts` lines 50–55: on `res.ok`, the toast says "Settings saved successfully" and doesn't include the response body's `message` field.

For the maintenance-mode screen the message is "Maintenance mode enabled successfully" — distinct from the generic "Settings updated" the use case returns. The current toast discards the richer server-side message.

### P2-7: `FeatureFlagsScreen` `updateNumericFlag` fires on every keystroke for `maxUploadSizeMb`
**File:** `web/src/components/admin/screens/FeatureFlagsScreen.tsx` lines 108–131: `onChange={(e) => updateNumericFlag(key, e.target.value)}` triggers a PUT for every character typed.

Should be debounced (300–500ms) or moved to a "blur to save" pattern with a visible unsaved-changes indicator.

### P2-8: `useSystemSettings.handleSave` doesn't invalidate any client cache after a successful save
**File:** `web/src/components/admin/screens/system-settings/useSystemSettings.ts` lines 62–83.

After saving, the local `editValues` state still contains the unsaved-looking value (it was updated optimistically, but if the save fails, there's no rollback). Compare to the feature-flags page (line 93-96 of `FeatureFlagsScreen.tsx`) which optimistically updates local state only after `res.ok`. The system-settings page also does that, but doesn't reset the `editValues` map after a successful save — so the `Save` button is still "enabled" (because `editValues[key] !== data.editable[key].value` is false, but a stale comparison can break the Save flow). The combination of "save succeeded" and "Save button still looks saveable" is a minor UX confusion.

### P2-9: `setMaintenanceMode` in `restore.service.ts` is dead code outside the data-management workflow
**File:** `web/src/server/modules/data-management/restore.service.ts` lines 28–55.

The function is defined but not exported. The actual restore code at line 30 of `restore/restore.service.ts` inlines the upsert. Pick one place to put it.

### P2-10: `useServerHealth.fetchHealth` is called once on mount with no auto-refresh interval
**File:** `web/src/components/admin/screens/server-health/useServerHealth.ts` line 87–89.

Server health is the kind of page that wants to auto-refresh every 30s or so. The Refresh button is there but the operator has to remember to click it. Add a `setInterval(30_000)` that re-fetches, paused while the page is hidden (`document.visibilityState`).

---

## Recommended fix order

| # | Item | Section | Effort | Risk |
|---|---|---|---|---|
| 1 | **P0-1** Maintenance mode enforcement | Configuration | 3–4h | Low (additive) |
| 2 | **P0-2** Caddy probe OR remove the row | Server Health | 10min–1h | Low |
| 3 | **P0-3** Scope the cache invalidation | Configuration | 30min | Low |
| 4 | **P1-6** Add missing settings to registry | Configuration | 1h | Low |
| 5 | **P1-1** Align route `isSuperAdmin` check | System Settings | 10min | Low |
| 6 | **P1-2** Fix `cpuUsage` / `ramUsage` mislabel | Server Health | 1h | Low |
| 7 | **P1-4** Maintenance banner input enablement | Configuration | 10min | Low |
| 8 | **P1-5** 401 redirect on system-settings | System Settings | 15min | Low |
| 9 | **P1-3** Consolidate /api/health calls | Server Health | 20min | Low |
| 10 | **P1-7** Move FLAG_LABELS into the lib | Configuration | 1h | Low |
| 11 | **P2-3** Replace hardcoded disk defaults | Server Health | 10min | Low |
| 12 | **P2-1** `isDirty` useMemo | Configuration | 5min | Low |

**Suggested PR shape (each shippable independently):**
- PR: "P0-1 maintenance mode enforcement" — 1 middleware patch + 1 rider-API endpoint + a Flutter banner hook. Requires QA against the DR runbook.
- PR: "P0-2 + P1-2 + P2-3 server health fixes" — 4 file changes, small, server-health-only.
- PR: "P0-3 + P1-6 + P2-1 settings hardening" — 1 route patch (cache scope), 1 registry extension, 1 use case hook perf fix.
- PR: "P1-1 + P1-5 system-settings permissions + 401" — small route + hook fix.

---

## Tests gap analysis

| Section | Existing test | What's missing |
|---|---|---|
| **Business Settings** (`/api/admin/settings`) | None | The full PUT round-trip (save 1 setting, GET, assert value) — would catch P1-6 (missing registry entries). |
| **System Settings** (`/api/admin/system-settings`) | None | The `isSecret` mask (P2-5), the SUPER_ADMIN gate (P1-1), the upsert behaviour. |
| **Maintenance Mode** (`/api/admin/maintenance-mode`) | None | The PUT persists, the GET reflects it. **Most importantly: a test that asserts that with `MAINTENANCE_MODE = 'true'`, a rider API request is rejected with 503** — would have caught P0-1 in CI. |
| **Feature Flags** | `feature_flags.test.ts` | The ENV-vs-DB precedence (line 18 of `feature-flags.ts`: defaults are ENV-based, DB overrides — does the current test exercise the override?). |
| **Health endpoints** | None | All 4 — but particularly the disk-degraded returns-200 question (P2-2). |

Adding a single test `tests/integration/maintenance_mode.test.ts` that asserts the middleware-level rejection is the highest-value test work — it's the gate that would have caught P0-1.

---

## Architecture observations (informational)

1. **The three sections share zero infrastructure.** The Configuration Business Settings uses `settingUseCases` (a per-key registry-driven approach), the System Settings uses a generic `db.systemSetting` findUnique, and the Feature Flags uses a third path (`flag.<key>` keys, in-process cache, `getAllFeatureFlags` helper). All three write to the same `SystemSetting` Prisma table but with different access patterns, different metadata, different validation. This is the "feature flag" pattern leaking into the table.

2. **The `category` column in `SystemSetting` is a free-text string, not an enum.** The schema (`schema.prisma:736`) is `category String`. The four callers use `BUSINESS`, `POLICY`, `NOTIFICATION`, `LOCATION`, `APP_URLS`, `STORAGE`, `BACKUP`, `SECURITY`, `SERVER`, `FEATURE` — and possibly more. The `CATEGORY_LABELS` and `CATEGORY_ICONS` maps in `system-settings/types.ts` are partial. Any new category silently renders as the raw string. Recommend migrating to an enum (with a migration plan — there are likely many rows already).

3. **Server Health's reliance on local Windows PowerShell CIM** (`/api/health/route.ts:30-37`) means the disk probe won't work on a Linux Vercel deploy — it falls through to the POSIX `df` fallback at line 56. The page therefore reports whatever `df -m` returns. On the local laptop the operator sees Windows drive letters; in the cloud they see container disk. The header copy says "Monitor local laptop service status" — fine for a local_laptop deployment, misleading elsewhere.

4. **The `isSuperAdmin` check in the system-settings hook reads the role from `/api/admin/auth/me`** (line 25 of `useSystemSettings.ts`). This is the only role-gate on the page that uses the live session, and it works, but it makes the page depend on a second API call (the GET to system-settings itself doesn't include the role). The role is also already in the JWT session payload — the server could include it in the GET response. Then the page would have one fewer network round-trip on mount.

5. **The maintenance banner message is stored as a SystemSetting key, but the CardDescription field is not part of the schema** (no `cardDescription` column). The "Pre-requisite" amber card is hardcoded JSX. Adding new pre-requisite warnings requires a code change.

6. **The `BACKUP_FREQUENCY`, `BACKUP_TIME_OF_DAY`, `BACKUP_KEEP_DAILY`, etc. settings are listed in the system-settings route comment** (lines 14–18) but are not in the editable settings the page renders. The comment says these are "Editable settings (stored in SystemSetting table)" but the page group only shows the 5 categories that exist in the seed data. If the backup team added these rows to the DB, they wouldn't be editable from the UI.

---

## Out-of-scope notes

- The **Audit Logs** section (visible in the admin nav) is a separate audit. It has the same audit-log write pattern that the configuration routes use (`.catch(() => {})` — fire-and-forget).
- The **Background Jobs** page is the right home for surfacing the "stuckCount" data the `/api/health/worker` endpoint exposes. Today the worker health check is on the Server Health page; the Background Jobs page is read-only.
- The **DR Drill** page has its own toggle to enable maintenance before a drill — that toggle writes to the same `SystemSetting` table and is also non-enforceable for the same reason as P0-1. Fix P0-1, the DR Drill page also works.
- The **Feature Flags** screen has an `enablePushNotifications` flag that is on by default. The previous messaging audit found that admin-initiated push notifications are broken for unrelated reasons (P0-4 of the messaging audit). Disabling this flag would silence the broken push channel — but the right fix is to repair the channel, not to disable the flag.
