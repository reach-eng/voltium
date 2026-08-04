# PR #6 — Loading Feedback + Haptics: Device Test Script

**Tester:** Voltium (physical device)
**Build:** Any build with PR #6 (`feat/ux-2-loading-haptics`) merged
**Goal:** Verify the 2 list screens that previously showed raw spinners
now show layout-matched skeletons, and the 3 critical buttons give
medium-haptic tactile feedback + label-swap while in flight.

---

## Before you start

1. Install the PR #6 build on a device with haptics enabled
   (most modern Android/iOS devices have this on by default).
2. Log in as a normal rider.
3. **Confirm haptics work on the device** — open any app that uses
   keyboard taps, type a few characters. If you feel a tick, the device
   supports haptics. If not, file a bug; the haptic portions of this
   test will be N/A.

---

## Test matrix (5 scenarios)

| # | Action | What should happen | Why |
|---|---|---|---|
| 1 | Tap **Send OTP** on login | Medium haptic + "Sending…" label appears next to spinner | High-stakes auth action |
| 2 | Tap **Verify & Proceed** on OTP screen | Medium haptic + "Verifying…" label appears next to spinner | High-stakes auth action |
| 3 | Tap **Proceed to Payment** on top-up | Medium haptic on press (no label-swap, the next screen loads) | High-stakes money action |
| 4 | Open **Wallet History** while data loads | Layout-matched skeleton (header card + 6 row tiles) appears for 1-2s, then real data | Replaces raw spinner |
| 5 | Open **Support → Tickets** while data loads | Layout-matched skeleton (4 list tiles) appears, then real tickets | Replaces raw spinner |

---

## For each scenario, check these things

### 1-3 (button scenarios)
1. **Haptic on press** — Tap the button. Within 100ms you should feel a
   short, firm tap (a "thunk" — heavier than a keyboard tick). This is
   `HapticFeedback.mediumImpact()`. If you don't feel anything, check
   Settings → Sounds & Haptics → System Haptics is ON (iOS) or
   Settings → Sounds → Vibration & haptic feedback (Android).
2. **Label swap on loading** — Within 200ms of the tap, the button text
   should change to the loading label (e.g. "Sending…", "Verifying…")
   AND a small white spinner should appear to the LEFT of the text.
3. **Button is disabled** — While loading, tapping the button again
   should do nothing (no second haptic, no second action). When loading
   completes, the button returns to its normal state.
4. **Button returns to normal** — After the action completes (success
   or error), the button goes back to its original label.

### 4-5 (skeleton scenarios)
1. **Layout doesn't jump** — When data finishes loading, the real list
   should appear in the same place as the skeleton, with the same
   vertical rhythm. You should NOT see a "flash" of empty space or a
   big reflow.
2. **Skeleton matches the real shape** — Wallet history should show a
   96-tall summary card placeholder at the top + 6 list-tile
   placeholders below. Tickets should show 4 list-tile placeholders.
3. **Shimmer animation** — The skeleton bars should slowly pulse
   (light gray ↔ slightly darker gray, ~1 second cycle). Not a
   spinner, not a static bar.
4. **Quick enough** — If your network is healthy, the skeleton should
   only show for 0.5-2 seconds. If you see it for >5 seconds, your
   network is slow and the skeleton is doing its job (giving you
   something to look at).

---

## Specific scenarios (step-by-step)

### #1 — Send OTP
1. Log out.
2. On the login screen, type a valid 10-digit phone number.
3. Tap **"Enter"** (the button label).
4. **Expected within 100ms:** Medium haptic. The button text changes
   to **"Sending…"** with a small spinner on the left.
5. Wait 1-3 seconds (real OTP arrives via SMS in test mode this is
   near-instant; in production it can be 2-5s).
6. **Expected after OTP arrives:** The app navigates to the OTP screen.
   The "Enter" button is no longer on screen (you've moved on).

### #2 — Verify & Proceed
1. From the OTP screen, type `000000` (an invalid code) and tap
   **"Verify & Proceed"**.
2. **Expected within 100ms:** Medium haptic. The button changes to
   **"Verifying…"** with a spinner on the left.
3. Wait 1-2 seconds for the failed verify call.
4. **Expected after failure:** The button returns to "Verify & Proceed"
   AND a red SnackBar appears at the bottom saying
   "Wrong code. Please try again." (this is from PR #3).
5. **Bonus:** When you type a real OTP and tap "Verify & Proceed", the
   same haptic + label-swap should fire. After success, you navigate
   to the dashboard.

### #3 — Proceed to Payment
1. Open Wallet → Top Up.
2. Enter an amount (e.g. ₹500), tap **"Proceed to Payment"**.
3. **Expected within 100ms:** Medium haptic. The button label does
   NOT change (because loading happens on the *next* screen, not
   this one — see PR description for why).
4. The next screen (UPI payment) should open within 500ms.

### #4 — Wallet History skeleton
1. From the wallet, tap "See all" → History. If your network is slow
   (e.g. throttled to 3G), the skeleton should show.
2. **Expected:** A 96-tall summary card placeholder at the top + 6
   list-tile placeholders (each showing a circle, a line, a smaller
   line, a right-aligned chip). NOT a single centered spinner.
3. The skeleton should pulse (shimmer) for 0.5-2s, then the real data
   appears in the same layout (no jump, no flash).

### #5 — Support Tickets skeleton
1. Open Support → Center.
2. **Expected:** The tickets area shows 4 list-tile placeholders (no
   trailing chevron in the skeleton — that comes from the real data).
3. Pulse for 0.5-2s, then real tickets appear (or the empty state from
   PR #4 if you have no tickets).

---

## What to look for (red flags — file a bug, don't pass)

- **No haptic on button press** but the device supports haptics.
  Means the `HapticService.medium()` call didn't fire.
- **Double-haptic on press** (one tap, two vibrations). Means
  the press handler is firing twice — should file a bug.
- **Label doesn't change** to "Sending…" / "Verifying…" while loading.
- **Spinner appears to the RIGHT of the text** (should be on the left).
- **Skeleton shows a centered spinner** instead of layout-matched
  placeholders. Means the migration didn't apply.
- **Skeleton flashes for <100ms** (the user can't see it). Means the
  data is loaded so fast the skeleton is invisible — that's actually
  a good sign, not a bug. The test should still pass.
- **Skeleton stays forever** (data never loads). Means the load
  failed silently — file a bug with the screen name.

---

## Sign-off

If all 5 scenarios pass (with the device's haptics enabled), mark the
PR **device-passed** with: "PR #6 — 5/5 flows pass device test. Skeletons
match the real layout, haptics fire on critical buttons, label-swap
works during loading."

If haptics are disabled on the test device, mark the PR device-passed
with: "PR #6 — 5/5 flows pass device test. Haptics N/A (device haptics
disabled); skeletons + label-swap verified." — the haptic code path
will still be exercised in production on real devices.
