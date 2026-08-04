# PR #3 — Error States: Device Test Script

**Tester:** Voltium (physical device)
**Build:** Any build with PR #3 (`feat/ux-1-error-states`) merged
**Goal:** Verify the 4 breakable flows show branded, specific error copy
instead of vague toasts, and that the persistent offline banner appears
when network drops.

---

## Before you start

1. Install the PR #3 build on a fresh device.
2. Log in as a normal rider (you don't need a new account for this one).
3. Have **airplane mode** easy to toggle (control center / quick settings).

---

## Test matrix (4 breakable flows + 1 infrastructure)

| # | Flow | How to break it | What should happen |
|---|---|---|---|
| 1 | Persistent offline banner | Turn on airplane mode | Persistent top banner ("You're offline" + icon) — NOT a one-time toast |
| 2 | Wrong OTP | Enter `000000` as the OTP code | Red SnackBar: "Wrong code. Please try again." (NOT a modal dialog) |
| 3 | Top-up failed | Try a top-up that fails server-side (use a known-bad amount or break the API) | Red SnackBar: "Payment not received yet. We'll auto-refresh in 30s — or tap 'Check status' below." (NOT `Failed: Exception(...)`) |
| 4 | KYC doc rejected | Submit a deliberately-blurry Aadhaar photo | Red SnackBar with the server's "Photo not clear" message (or "Hold the camera steady, make sure all 4 corners..." if the server is silent) |
| 5 | Dashboard offline | Turn on airplane mode, open the dashboard | Full-screen `ErrorState.network` with "Couldn't reach the command center" + retry button |

---

## For each scenario, check these 6 things

1. **Color** — Red surface (`#FEF2F2` background), red icon, red SnackBar background. NOT raw theme-default red.
2. **Shape** — SnackBars are **floating, pill-shaped, 16px margin from screen edges**. NOT full-width bottom flush.
3. **Icon** — Each error has the right Material icon (cloud-off for network, password for OTP, account-balance-wallet for top-up, no-photography for doc).
4. **Copy** — Specific to the situation, includes a **next step** ("tap Check status", "try again in good light"). NOT a generic "Something went wrong."
5. **Duration** — Stays for 3-5 seconds, not instant-fading.
6. **No exception leaks** — Nowhere in the app should you see literal `Exception:`, `Error:`, stack-trace text, or `Failed: $e` patterns.

---

## Specific scenarios

### #1 — Persistent offline banner
1. Open the app, log in. You should see the normal dashboard.
2. Pull down the **control center**, turn on **airplane mode**.
3. **Within 1-2 seconds**, a red banner should appear at the very top of the
   app (above the SyncBanner and SuspensionBanner). It should say
   "You're offline" with a cloud-off icon.
4. **The screen should still be visible and tappable** — the banner is
   non-modal, it doesn't block the UI.
5. **Tap the "Retry" button** (if you see one) — the banner should briefly
   hide and reappear if still offline.
6. Turn off airplane mode. The banner should disappear within 1-2 seconds.
7. Navigate between tabs (Dashboard, Wallet, Support, Profile). The banner
   should track with you on every tab.

### #2 — Wrong OTP
1. Log out, log back in with a valid phone number.
2. **Before the OTP arrives**, type `000000` and tap "Verify".
3. **Expected:** A red floating SnackBar appears at the bottom, saying
   "Wrong code. Please try again." with a password icon. NOT a modal
   dialog that you have to dismiss.
4. The OTP input should still be focused — you can immediately retype.
5. **Now wait for the real OTP**, type it, verify. The success SnackBar
   should be **green** ("New code sent. Check your messages." — wait, this
   is the resend-success, not the verify-success. The verify-success should
   navigate you to the next screen, not show a SnackBar). Tap "Resend" —
   expect the green success SnackBar.

### #3 — Top-up failed
1. As a logged-in rider, open Wallet → Top Up.
2. Enter any amount (e.g. ₹500), proceed to UPI screen, submit.
3. **To force a failure:** turn on airplane mode right before tapping
   "Submit" on the UPI screen. Or use a known-bad amount if your test
   build has one.
4. **Expected (old, broken behavior):** A SnackBar saying
   `Failed: SocketException: Failed host lookup: ...` — your team should
   **NOT** see this.
5. **Expected (new, PR #3 behavior):** A red floating SnackBar saying
   "Payment not received yet. We'll auto-refresh in 30s — or tap 'Check
   status' below." with a wallet icon.
6. **The snackbar text must NOT contain** the words "Exception",
   "SocketException", "Error:", "Stack trace", or a JSON object.

### #4 — KYC doc rejected (deliberately blurry)
1. As a rider who's at the KYC docs step, open the camera.
2. Point it at a wall, take a photo, submit.
3. **If the server validates** (most builds do), expect a red floating
   SnackBar with the server's error message OR the new fallback
   "Photo not clear. Hold the camera steady, make sure all 4 corners are
   visible, and try again in good light." with a no-photography icon.
4. **The snackbar should NOT say** "Something went wrong" or
   "Please check your documents" (the old generic copy).
5. **The snackbar shape:** floating pill, 16px margin, red background,
   white text with the icon on the left.

### #5 — Dashboard offline (full-screen)
1. Open the app, log in normally. The dashboard loads.
2. Turn on airplane mode.
3. **If your app has a force-refresh on dashboard** (pull-to-refresh), pull
   down. The screen should now show the full-screen `ErrorState.network`
   widget: a red circle with a cloud-off icon, "Couldn't reach the
   command center" title, a longer message, and a Voltium-Blue "Retry"
   button.
4. **Tap Retry** — should re-attempt the load. If still offline, the
   widget reappears.
5. Turn off airplane mode, tap Retry again. The dashboard should reload.

---

## What to look for (red flags — file a bug, don't pass)

- **A SnackBar saying `Failed: $e`** anywhere. This is the OLD top-up
  error. If you see it, the migration to PR #3 didn't apply.
- **A dialog box** for "Wrong code". Should be a SnackBar so the rider
  can immediately retype.
- **No persistent banner when offline** (banner missing, only one-time
  toast). Means the `NetworkStatusBanner` wrap didn't apply.
- **A "Something went wrong" toast** on the dashboard when offline. The
  new copy should be "Couldn't reach the command center".
- **Banner blocks the screen** (e.g. covers the bottom nav). It should
  sit at the very top, above the SyncBanner.
- **Banner doesn't disappear** when back online. Pull-to-refresh should
  also dismiss it.

---

## Sign-off

If all 5 scenarios pass (offline banner, OTP, top-up, KYC, dashboard),
mark the PR **device-passed** in the PR comment with: "PR #3 — 5/5 flows
pass device test. Error copy is consistent, no exception leaks, offline
banner persistent."

If any fails, file a bug with the scenario number + which numbered check
failed + a screenshot.
