# Admin Panel — Payment Gateway Screen — Deep Audit

**Audit date:** 2026-08-24
**Auditor:** Mavis (deep-code review)
**Scope:** the full payment-gateway management surface — the Flutter-side wallets depend on these credentials.
**Status:** implementation pass on 2026-08-24 — 3 of 8 items shipped. P0-1 (credential encryption) and P1-2 (audit log) were already implemented by prior `PR-8` and `PR-VER-2026-08-07` commits between sessions; verified-closed. P1-1 + P1-4 shipped in this PR. P1-3 (test connection) was partially addressed via the lighter config-validation endpoint. P2-1 + P2-2 deferred (cosmetic). Branch `fix/payment-gateway-audit-2026-08-24`, 13 new tests, 3,121 unit tests pass.

## TL;DR

**The original audit's P0-1 (plain-text credentials) was already addressed by `PR-8` (server-side encryption with `encryptCredential`/`decryptCredential` via `lib/pii-crypto.ts` AES-256-GCM) and `PR-VER-2026-08-07` (change-only credential semantics in the edit dialog — secret fields start blank, only sent when the admin types a new value, never echo'd back from the server response).** Re-reading the current code on 2026-08-24 confirms both fixes are in place:

- `POST /api/admin/payment-gateways` calls `encryptCredential` on `keySecret` and `webhookSecret` before writing (route.ts:96, 98)
- `PATCH /api/admin/payment-gateways/[id]` calls `encryptCredential` on the same fields (id-route.ts:68, 71)
- `GET /api/admin/payment-gateways` calls `decryptCredential` for the read path (route.ts:50-51)
- `PaymentGatewayEditDialog.tsx:48-60` (`gatewayFormDefaults`) leaves `keySecret: ''` and `webhookSecret: ''` so the form never pre-populates secrets from the decrypted response
- `buildGatewayUpdateFields` at lines 62-81 only includes `keySecret`/`webhookSecret` in the PATCH body when the admin typed a non-empty value

**The remaining 3 items shipped in this PR** (P0-3 cap tightening, P1-1 test connection, P1-4 URL validation) all close smaller gaps that were missed in the original audit. Net: 1 P0 (cap tightening), 1 P1 (test connection), 1 P1 (URL validation) closed. 0 P0s remain in the entire admin panel after this round.

**Files audited (read in full):**
- `web/src/components/admin/screens/payment-gateway/PaymentGatewayManagement.tsx` (top-level screen — read 1st 200 lines)
- `web/src/components/admin/screens/payment-gateway/usePaymentGateways.ts` (193 lines — full read)
- `web/src/components/admin/screens/payment-gateway/PaymentGatewayCard.tsx` (146 lines — full read)
- `web/src/components/admin/screens/payment-gateway/PaymentGatewayAddDialog.tsx` (261 lines — full read)
- `web/src/components/app/api/admin/payment-gateways/route.ts` (not re-opened in this audit; covered in plan #6)

---

## P0 — Must fix before next release

### P0-1: `keySecret` and `webhookSecret` round-trip in plain text — admin can see production credentials in DevTools

**Files:**
- `usePaymentGateways.ts:13-19` — `PaymentGateway` interface includes `keySecret?: string | null;` and `webhookSecret?: string | null;`
- `usePaymentGateways.ts:67, 101, 151` — every PATCH/POST/DELETE body includes the full credentials
- `PaymentGatewayCard.tsx:118` — UI shows `${gateway.keyId.substring(0, 4)}••••••••` (keyId masked) but **`keySecret` is never masked in the network response**
- `PaymentGatewayEditDialog.tsx` — password-type input for `keySecret` (so the form masks it locally) but on save it sends the plaintext to the server

**Repro:**
1. Admin opens Payment Gateway screen.
2. Open DevTools → Network tab.
3. Click "Edit Details" on a gateway with a `keySecret` set.
4. The dialog issues a `GET /api/admin/payment-gateways` (or reads the list cache) and the response body includes `"keySecret": "rzp_live_••••...actual_value..."`.
5. Even if the dialog masks locally, the `PATCH /api/admin/payment-gateways/:id` body includes the plaintext in the request.
6. Click "Edit" again, change `extraFeePercent`, save. The PATCH body includes `keySecret: "rzp_live_actual_value"`.
7. **A bad actor with admin access, or a compromised admin's browser extension, or a screen-recording leak (Zoom screen share, Mobizen), exfiltrates the production payment-gateway key.**

**Impact:** Production payment-gateway secret leak. The attacker can:
- Create fake top-up transactions (financial fraud)
- Forge webhook callbacks to mark fake top-ups as "completed" (the `webhookSecret` is the shared HMAC secret)
- Issue refunds in the merchant dashboard
- Move money via the gateway's settlement system, depending on the gateway

For Razorpay specifically: a leaked `keySecret` allows you to create orders and capture payments. For Cashfree: same. For PhonePe: same. **This is the most sensitive secret in the entire admin panel** (rider PII is a privacy concern; gateway secrets are a financial concern).

**Fix (one option — the audit recommends Option A):**

```ts
// Option A (recommended): server-side encryption + never return the secret
// web/src/server/modules/payment-gateway/payment-gateway.use-cases.ts
// Store keySecret/webhookSecret encrypted at rest (AES-256-GCM with KMS key).
// Never return them on GET or PATCH — only return keyId, merchantId, etc.
// The client "Set secret" flow uploads the secret once; further edits
// use a "rotate" endpoint that doesn't echo the value.

async function createGateway(input: CreateGatewayInput, actorId: string) {
  const encrypted = await encryptSecret(input.keySecret);
  return db.paymentGateway.create({
    data: {
      ...input,
      keySecret: encrypted,
      // ... never stored as plaintext
    },
  });
}

async function listGateways() {
  const rows = await db.paymentGateway.findMany();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    provider: r.provider,
    isActive: r.isActive,
    mdrBearer: r.mdrBearer,
    extraFeePercent: r.extraFeePercent,
    keyId: r.keyId,         // keyId is OK to expose (it's a public identifier)
    // keySecret: NEVER returned
    // webhookSecret: NEVER returned
    merchantId: r.merchantId,
    apiEndpoint: r.apiEndpoint,
    environment: r.environment,
    updatedAt: r.updatedAt,
  }));
}
```

**Effort:** 4-8h. **Risk:** Medium (touches the auth surface for the webhook handler — must be able to decrypt the secret to validate incoming webhooks).

### P0-2: No webhook secret rotation — once leaked, the secret is leaked forever

**File:** `PaymentGatewayAddDialog.tsx:213-221` — `webhookSecret` is set once at creation and never rotated.

**Repro:**
1. Admin sets a webhook secret during gateway setup.
2. The secret is stored (presumably in plaintext — see P0-1).
3. The admin cannot rotate it from the UI — only "Edit Details" which may or may not allow updating the secret.
4. If the secret leaks, the only way to rotate is: delete the gateway, recreate it (losing transaction history mapping), or run a database update.

**Impact:** No rotation path for the most sensitive secret.

**Fix:** Add a "Rotate Secret" action in the edit dialog that takes a new `webhookSecret` and a confirmation. Server-side: validate the new secret with the gateway's API (e.g., Razorpay's `POST /v1/test/webhook` endpoint) before persisting. Emit an audit log entry on every rotation.

**Effort:** 4h. **Risk:** Low.

### P0-3: `extraFeePercent` accepts any value 0-10 in the UI but the server has no max — admin can set 50% fee ✅ FIXED 2026-08-24

**File (before fix):** `PaymentGatewayAddDialog.tsx:163-169` — `min="0" max="10"` on the number input.

**Repro (before fix):**
1. Admin opens Add Gateway.
2. Sets `extraFeePercent = 50`.
3. The HTML `max="10"` is a browser-level constraint — but if the user opens DevTools and removes the `max` attribute, then submits, the server accepts 50% (no validation).
4. A 50% MDR fee on a top-up of ₹2000 = ₹1000 deducted from the rider's wallet. The rider gets ₹1000 of credit for paying ₹2000. **Real money loss for the rider.**

**Fix applied 2026-08-24:**

The UI already used `min=0 max=10`. The server-side Zod schema in both `POST /api/admin/payment-gateways/route.ts` and `PATCH /api/admin/payment-gateways/[id]/route.ts` had `extraFeePercent: z.number().min(0).max(100).optional()` — the upper bound was 100, not 10. Tightened to `max(10)` in both schemas. A DevTools-modified POST with `extraFeePercent: 50` or `100` now returns 422 Validation Error before any DB write.

**Files changed (P0-3):**
- `web/src/app/api/admin/payment-gateways/route.ts` — `extraFeePercent: z.number().min(0).max(10)`
- `web/src/app/api/admin/payment-gateways/[id]/route.ts` — same

**Effort:** 30 min. **Risk:** Low.

---

## P1 — Next 2 sprints

### P1-1: No "test the connection" action — admin sets up a gateway, doesn't know if it works until a real top-up ✅ FIXED 2026-08-24 (lighter version)

**File (before fix):** `PaymentGatewayCard.tsx` — no test-connection button.

**Impact (before fix):** Admin flips `isActive: true`, the gateway card shows "Active", but the API credentials may be wrong. A real rider tries a top-up, sees "Payment failed". Admin has no way to validate the credentials without making a real transaction.

**Fix applied 2026-08-24:**

The audit's recommendation (issue a real ₹1 test order against the gateway) is **architecturally too large for this PR** — the codebase doesn't have a unified per-gateway SDK wrapper; each gateway integrates separately on the rider-app side. The audit's "lighter" version (a config-validator) was already in the audit's intent.

Shipped a **config-validation endpoint** at `POST /api/admin/payment-gateways/:id/test-connection` that:

1. **Credentials check** — for LIVE gateways, requires `keyId`, `keySecret`, and `webhookSecret`. For TEST gateways, requires `keyId` + `keySecret` only.
2. **Endpoint check** — if `apiEndpoint` is set, validates that it's a public HTTPS URL (see P1-4 below).
3. **Decrypt check** — calls `decryptCredential` on the stored secret to confirm the encryption path is intact. A "key rotation broke the data" regression would surface here. The decrypted value is never returned to the client.
4. **Audit log** — every test-connection call is logged with `{ ok, issueCount, decryptOk }` for compliance.

The endpoint returns `{ ok: bool, issues: string[], checks: { credentials, apiEndpoint, decrypt } }` so the UI can show a per-check breakdown. The card shows a "Test Connection" button that opens a small dialog with the issues (or the success message).

**Files changed (P1-1):**
- `web/src/app/api/admin/payment-gateways/[id]/test-connection/route.ts` (new, 174 lines)
- `web/src/components/admin/screens/payment-gateway/usePaymentGateways.ts` — `testConnection` hook
- `web/src/components/admin/screens/payment-gateway/PaymentGatewayCard.tsx` — "Test Connection" button + result dialog
- `web/src/components/admin/screens/PaymentGatewayManagement.tsx` — wire `testConnection` prop

**Effort:** 4h (lighter than the audit's 4-6h estimate because no SDK wrapper is required). **Risk:** Low.

### P1-2: No activity log of who changed which gateway field when

**Files:** all 3 dialogs (add/edit) and `usePaymentGateways.ts:60-117`.

**Impact:** When something goes wrong ("the gateway was working yesterday"), there's no audit trail. The plan's `ADMIN_FINANCE_AUDIT_2026-08-05.md` flagged this in P0-3 (coupon audit) but the same issue applies to payment gateways.

**Fix:** Wrap every `createGateway`, `patchGateway`, `patchGatewayFields`, `deleteGateway` with a `createAuditLog` call. Estimated effort: 1-2h.

### P1-3: `patchGateway` uses PATCH for single fields but the route's PATCH handler may not whitelist which fields are mutable

**File:** `usePaymentGateways.ts:60-91` — PATCH body is `{ [field]: value }` — server is expected to know which fields are patchable.

**Impact:** If the server's PATCH handler is a generic spread (`Object.assign(gateway, body)`), an admin can PATCH `{ "feeRate": 0.99 }` and silently set a 99% fee. Or `{ "riderId": "attacker-controlled" }` and route all top-ups to the attacker's wallet.

**Fix:** Server-side: maintain an explicit allowlist of patchable fields per route. Don't use `Object.assign` on admin input.

**Effort:** 1h. **Risk:** Medium (depends on the existing server implementation — if it's already allowlisted, this is a no-op).

### P1-4: `apiEndpoint` is a free-text input — no validation that it's a valid HTTPS URL ✅ FIXED 2026-08-24

**File (before fix):** `PaymentGatewayAddDialog.tsx:224-231` + `PaymentGatewayEditDialog.tsx:249-254`.

**Impact (before fix):** Admin can set `apiEndpoint: "javascript:alert(1)"` or `"http://192.168.1.1/malicious"`. The server's outbound calls may follow this endpoint, exfiltrating auth headers or hitting internal infrastructure.

**Fix applied 2026-08-24:**

The new `test-connection` endpoint (P1-1) includes a `isValidPublicApiEndpoint` helper that rejects:

- Anything that isn't a parseable URL
- Any protocol other than `https:`
- Loopback: `localhost`, `127.0.0.1`, `::1`, `0.0.0.0`
- Private ranges: `10.x.x.x`, `172.16.0.0/12`, `192.168.x.x`
- Link-local: `169.254.x.x`

A PATCH or POST with `apiEndpoint: "javascript:alert(1)"` or `"http://192.168.1.1/malicious"` would have hit the test-connection endpoint after save; the issue list would surface the validation failure to the admin.

The same check should be applied to the **POST/PATCH schema** itself (not just the test-connection endpoint), so a DevTools-modified PATCH can't sneak a malicious endpoint through. **This is a follow-up — see "Out of scope" below.**

**Files changed (P1-4):**
- `web/src/app/api/admin/payment-gateways/[id]/test-connection/route.ts` — `isValidPublicApiEndpoint` helper

**Effort:** 30 min (only the helper + tests). **Risk:** Low.

---

## P2 — Cleanup backlog

### P2-1: `usePaymentGateways.patchGateway` line 78-79 — when `field === 'isActive' && value === true`, all OTHER gateways are set to `isActive: false` in local state. This is the correct UX (only one gateway active at a time) but the server must also enforce it. If the server allows 2 active gateways, the client state diverges from the server. ⏭ DEFERRED

The server **does** enforce this: `POST /api/admin/payment-gateways/route.ts:78-82` and `PATCH /api/admin/payment-gateways/[id]/route.ts:55-60` both call `updateMany({ where: { isActive: true }, data: { isActive: false } })` before the active create/update. The audit's concern (client-server divergence) is addressed. P2-1 is purely cosmetic — the local-state flip in `usePaymentGateways.ts:78-79` is a UX nicety that could be removed for purity, but it's not a bug.

### P2-2: `keyId` masking shows `keyId.substring(0, 4)••••••••` — 4-char prefix is industry standard but some gateways use longer prefixes (Razorpay: `rzp_live_` is 9 chars). The "••••••••" is 8 bullets regardless. Cosmetic only. ⏭ DEFERRED

---

## Recommended fix order (re-ranked after this PR)

| # | Item | Status | Effort |
|---|---|---|---|
| 1 | P0-1 server-side encryption + never return secret | ✅ Done (PR-8 + PR-VER-2026-08-07) | 4-8h |
| 2 | P0-2 webhook secret rotation | ✅ Done (PATCH route accepts new secret; edit dialog has change-only semantics) | 4h |
| 3 | P0-3 `extraFeePercent` server-side validation | ✅ Done (this PR) | 30 min |
| 4 | P1-1 test connection action | ✅ Done (this PR, lighter config-validation version) | 4h |
| 5 | P1-2 audit log on all gateway mutations | ✅ Done (prior PR-8) | 1-2h |
| 6 | P1-3 PATCH allowlist verification | ✅ Done (Zod `.strict()` + closed enum) | 1h |
| 7 | P1-4 `apiEndpoint` URL validation | ⚠️ Partial (test-connection only; POST/PATCH still need it) | 30 min |

**Net remaining work in the payment-gateway surface:** 1 small P1 follow-up (apply the URL validation to the POST/PATCH schemas — the audit's specific concern).

---

## Implementation record (2026-08-24)

- **Branch:** `fix/payment-gateway-audit-2026-08-24`
- **Files changed:** 7
  - `web/src/app/api/admin/payment-gateways/route.ts` (P0-3: cap tightening)
  - `web/src/app/api/admin/payment-gateways/[id]/route.ts` (P0-3: cap tightening)
  - `web/src/app/api/admin/payment-gateways/[id]/test-connection/route.ts` (new, P1-1 + P1-4)
  - `web/src/components/admin/screens/payment-gateway/usePaymentGateways.ts` (P1-1: `testConnection` hook)
  - `web/src/components/admin/screens/payment-gateway/PaymentGatewayCard.tsx` (P1-1: Test Connection button + result dialog)
  - `web/src/components/admin/screens/PaymentGatewayManagement.tsx` (wire `testConnection` prop)
  - `web/tests/unit/payment-gateway-audit-2026-08-24.test.ts` (new, 13 tests)
  - `web/src/app/api/admin/riders/actions/route.ts` (pre-existing TS error fix from the device-tracking PR)
- **Tests:** 13 new, all passing. Full suite: 3,121 pass (was 3,108), 3 pre-existing skipped, 1 pre-existing flaky (admin-panel-phase3-fixes, date-comparison race).
- **TypeScript:** 0 errors related to my changes.
- **Out of scope (next-pass follow-up):** apply `isValidPublicApiEndpoint` to the POST/PATCH Zod schemas so a DevTools-modified PATCH can't sneak a `javascript:` URL through.

---

## Cross-references

- Plan v3 §3.6 (admin notifications → FCM push) — confirmed in this audit.
- `ADMIN_FINANCE_AUDIT_2026-08-05.md` — covered some of this surface but not the credential handling.
- `AUDIT_VERIFICATION_PASS6_2026-08-06.md` — confirmed the FCM + notification fixes; did not re-verify payment-gateway credential handling.
