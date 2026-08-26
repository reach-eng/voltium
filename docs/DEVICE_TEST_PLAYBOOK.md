# Voltium — Device Test Playbook (Android)

**Date:** 2026-07-29
**For:** Physical tester on Android device
**Goal:** Run a complete, repeatable pass through every Voltium rider-app screen. Surface regressions and bugs the dev team can fix.
**Time estimate:** 60–90 minutes for a full first pass. Once you know the app, you can do it in 30–45 min.

> **You do not need to read code.** This is a phone-only test script. Every step tells you: which screen, what to do, what "good" looks like, and what "bad" looks like. If something looks bad — file a bug using the format in `docs/BUG_REPORT_TEMPLATE.md`.

> **Found a bug?** Open `docs/BUG_REPORT_TEMPLATE.md`, fill it in, send to the dev team. Sort by severity: CRASH first.

---

## Before you start

### You need

1. **Your Android device** with the **latest dev build** of the Voltium app installed
2. **A second device or piece of paper** — for taking notes as you go
3. **A test phone number** the dev team gave you (likely +91-XXXXX-XXXXX, maybe a special dev number)
4. **A test OTP** — ask the dev team; the dev build might have a magic OTP like `111111` or display it on screen
5. **~10% battery at minimum**, ideally full
6. **Mobile data on** (not just Wi-Fi) — the app should work on real network, not just your laptop

### Setup (one time, ~5 min)

1. **Force-quit the Voltium app** (Settings → Apps → Voltium → Force Stop)
2. **Turn on airplane mode for 10 seconds, then off** — this resets the network state
3. **Open the Voltium app fresh** — you should land on the **Splash screen**
4. **Open your notes app** — create a new note called "Voltium Test — [today's date]". You'll log issues here as you go.
5. **Take a screenshot of the Splash screen** — call it `01_splash.png`. This is your "starting point" so you can compare before/after if something breaks later.

### How to use this playbook

For each section:
- ✅ = "I did this and it worked as expected"
- 🐛 = "Something looked wrong" → log a bug in your notes (use the template in `docs/BUG_REPORT_TEMPLATE.md`)
- ⏭️ = "I skipped this step" (some steps need specific accounts or test data you might not have — that's fine, just note it)

At the end of each section, write a one-line summary: **"Section X: ✅ all good** / **🐛 found N issues**".

If you find a **crash** (app closes, white screen, frozen screen), note it as **SEVERITY: CRASH** — those go to the top of the bug list.

## Two ways to use this

**Full pass (first time, or after big changes):** Start at Section 1 and go all the way to Section 10. ~60–90 min. Catches everything.

**Smoke test (weekly, between full passes):** Skip Sections 1, 2, 3 (auth + onboarding — those don't change often). Start at Section 4 and go to Section 10. ~30–40 min. Catches regressions in the parts of the app that change most.

---

# Test Plan

## Section 1 — First launch & legal flow (~3 min)

This tests: app starts correctly, splash screen, legal consent.

### Step 1.1 — Cold start
1. Force-quit the app (if not already done)
2. Tap the Voltium app icon
3. Watch what happens in the first 3 seconds

**Good:** A splash screen shows the Voltium logo + "Voltium" name, then transitions smoothly to the next screen.

**Bad:** Black screen, app closes immediately, frozen on white, app takes more than 5 seconds to show anything, error message visible.

🐛 If bad → log it. Note: did the splash appear at all? How long did you wait? What did you see?

### Step 1.2 — Legal screen
1. After splash, you should land on a **Legal / Terms screen**
2. Scroll to the bottom of the terms text
3. Look for two buttons: "I Agree" and "I Don't Agree" (or similar)

**Good:** You can scroll the full text, the "I Agree" button is visible and tappable.

**Bad:** Text is cut off, can't scroll, buttons are tiny (< finger-sized), text is unreadable (too small or wrong color), buttons are missing labels.

### Step 1.3 — Permissions screen
1. Tap "I Agree"
2. The next screen should ask for **permissions** (location, camera, notifications, etc.)
3. Look at each permission prompt

**Good:** Each permission has a clear name and a "Allow" / "Deny" button. The descriptions explain why Voltium needs it.

**Bad:** Permissions are missing, or the screen is blank, or the buttons don't work when tapped.

**Tip:** For this first test pass, **tap Allow on everything.** We test what happens with permissions denied in a separate pass.

### Step 1.4 — Permissions consequence
1. After granting permissions, does the app move forward to the next screen (login)?

**Good:** Transitions to login within 2 seconds.

**Bad:** Stuck on permissions screen, asks for permissions again, crashes.

**Section 1 summary:** Write it down. ✅ or 🐛.

---

## Section 2 — Login & OTP (~5 min)

This tests: phone number entry, OTP receipt, OTP verification.

### Step 2.1 — Login screen
1. You should now see a **Login screen** with a phone number field
2. Type your test phone number
3. Look at the field carefully — does it auto-format with spaces/dashes? Can you see what you typed?

**Good:** The phone field shows your number clearly. Country code is pre-selected (likely +91 for India). You can delete and re-type.

**Bad:** Can't see what you typed, can't delete, no country code selector, crashes when you type, weird characters accepted.

### Step 2.2 — Send OTP
1. Tap the **"Send OTP" / "Get OTP"** button
2. Wait up to 30 seconds

**Good:** A success message or a "OTP sent" indicator appears. The screen transitions to an OTP entry screen.

**Bad:** Nothing happens, error message, the button doesn't respond, app crashes, OTP never arrives.

### Step 2.3 — OTP entry
1. You should see **6 boxes (or one long field) for the OTP**
2. Check your messages / ask dev team for the OTP
3. Type the OTP

**Good:** Boxes auto-advance as you type, you can edit if you make a mistake, the "Verify" button activates when 6 digits are entered.

**Bad:** Boxes don't advance, can't delete, no "Verify" button, OTP auto-fills wrong, no haptic feedback (phone doesn't vibrate subtly when typing).

### Step 2.4 — Verify
1. Tap **"Verify"**
2. Wait up to 10 seconds

**Good:** Transitions to the main dashboard. You see your name, wallet balance, recent activity.

**Bad:** "Invalid OTP" error, "OTP expired" error, app crashes, stuck on loading spinner, transitions to a wrong screen.

### Step 2.5 — Wrong OTP test (regression check)
1. Force-quit the app and reopen it
2. Get to the OTP screen again
3. Type **6 wrong digits** (e.g., 000000)
4. Tap Verify

**Good:** Shows "Invalid OTP" message, lets you retry. The error message is in plain English (not a code).

**Bad:** Crashes, shows a technical error (like "AUTH_OTP_INVALID" or a stack trace), infinite spinner, no retry option.

**Section 2 summary:** ✅ or 🐛.

---

## Section 3 — Onboarding (first time only) (~10 min)

**Skip this section if you've already onboarded.** Only do this on a fresh account or if the dev team asks you to test the onboarding flow.

This tests: intent of use, profile, signature, documents, guarantor.

### Step 3.1 — Intent of use
1. After login, if it's a new account, you'll see a screen asking "What will you use Voltium for?" with options like Personal / Business / Delivery
2. Pick one and tap Next

**Good:** Selection is clear, Next button is visible, you can go back and change.

**Bad:** Options are unclear, Next button hidden, can't go back, crashes.

### Step 3.2 — Rider profile
1. Fill in name, email, address, etc.
2. Try **invalid input** (e.g., a name with only spaces, an email without @, a phone number with letters)

**Good:** The app tells you what's wrong (e.g., "Please enter a valid email") in plain language.

**Bad:** Crashes, accepts invalid input, no error message, error message is a code like "VALIDATION_ERROR".

### Step 3.3 — Signature
1. The app will ask you to draw your signature with your finger
2. Draw something, then tap "Save" or "Next"

**Good:** Your signature is captured. You can see a preview. You can clear and re-draw.

**Bad:** Signature is invisible, can't clear, the saved signature looks like a scribble, crashes when drawing.

### Step 3.4 — Documents
1. The app will ask you to upload photos of documents (ID, license, etc.)
2. Tap "Take photo" or "Choose from gallery"
3. Take a photo or pick one

**Good:** Camera opens, you can take the photo, the photo is attached and visible in the form.

**Bad:** Camera doesn't open, app crashes when tapping the button, photo uploads but doesn't show, photo is rotated wrong.

### Step 3.5 — Guarantor
1. The app will ask for a guarantor's name and phone number
2. Fill in the form
3. There may be a "Send invite to guarantor" step

**Good:** Form is clear, the invite sends (or the dev team shows a success message), you can move on.

**Bad:** Form is broken, invite doesn't send, crashes, "guarantor" is misspelled everywhere.

**Section 3 summary:** ✅ or 🐛. (Skip if not applicable.)

---

## Section 4 — Plan & deposit (~8 min)

This tests: choosing a plan, top-up, UPI payment, receipt.

### Step 4.1 — Choose plan
1. After onboarding (or from the dashboard), tap something like "Choose a plan" or "Start rental"
2. You should see 2–4 plan options (Daily / Weekly / Monthly)

**Good:** Plans are clearly labeled with price, duration, and what's included. There's a "Choose" button on each.

**Bad:** Plans are missing prices, no clear "best value" indication, buttons are tiny, can tap a plan but nothing happens.

### Step 4.2 — Plan success
1. After picking a plan, you should see a "Plan selected!" or "All set!" screen

**Good:** Clear confirmation, you can move to the next step (top-up).

**Bad:** Stuck on a loading screen, error message, the screen is blank.

### Step 4.3 — Top-up purpose
1. The app should ask "Why are you topping up?" with options (Rental / Wallet / Deposit)

**Good:** Options are clear, you can pick one and move on.

**Bad:** Options are unclear, no clear "next" button, crashes.

### Step 4.4 — Amount
1. The app should suggest an amount or let you type one

**Good:** Suggested amounts are reasonable (not ₹1, not ₹100,000). You can type a custom amount.

**Bad:** Suggested amounts are weird, you can't type, the keyboard covers the field, no "Pay" button.

### Step 4.5 — UPI / payment
1. The app should show a UPI payment flow (QR code, UPI app picker, or card form)
2. If the flow asks you to upload a payment **proof** (screenshot of the payment), do that step too

**Good:** The QR code is visible and scannable. If you pick "Pay with PhonePe / GPay / Paytm", the right app opens. If proof upload is required, you can attach a screenshot.

**Bad:** QR code is missing, QR code is broken (won't scan), the UPI app picker shows apps that aren't installed, payment succeeds in the app but the balance doesn't update, proof upload crashes.

### Step 4.6 — Receipt
1. After "payment", the app should show a receipt screen

**Good:** Receipt shows: amount, date, transaction ID, and a "Download" or "Share" button. You can go back to the dashboard.

**Bad:** Receipt is missing, transaction ID is "null" or "undefined", can't go back, the screen says "error" with no details.

**Section 4 summary:** ✅ or 🐛.

---

## Section 5 — Pickup & rental (~15 min — the meat of the app)

This tests: pickup hub, vehicle selection, photo capture, active dashboard, ending a rental.

**This section needs real test data** — a vehicle assigned to your account. If you don't have one, ask the dev team to assign you one. Or skip to Section 6.

### Step 5.1 — Pickup hub
1. From the dashboard, tap something like "Pickup" or "Start trip"
2. You should see a screen listing nearby hubs (or one hub if there's only one in your area)

**Good:** Hubs are listed with name, distance, address. There's a "Select" button.

**Bad:** No hubs listed, "No hubs available" message, crashes, hubs listed but tapping does nothing.

### Step 5.2 — Vehicle photos
1. After picking a hub, you should see the vehicle assigned to you (with a photo and details)

**Good:** Vehicle photo is clear. You see plate number, model, color, battery level.

**Bad:** Photo is missing or broken (gray box), plate number is "N/A", battery shows 0% (even if you know it's full).

### Step 5.3 — Pickup verification
1. The app should ask you to take photos of the vehicle (front, back, sides, odometer)
2. Take a few photos

**Good:** Camera opens, photos save, you can see thumbnails of what you've taken. There's a "Done" or "Next" button.

**Bad:** Camera crashes, photos don't save, "Done" button missing, photos are blurry, photos are uploaded but the next screen doesn't acknowledge them.

### Step 5.4 — Pickup success
1. After verification, you should see "Pickup confirmed!" with a "Start ride" button

**Good:** Clear success message, the button works, you transition to the active dashboard.

**Bad:** Stuck loading, error, the "Start ride" button does nothing.

### Step 5.5 — Active dashboard
1. You should see a screen showing: vehicle info, battery %, lock/unlock button, "End rental" button, possibly a map

**Good:** All elements are visible. The lock/unlock button changes state when tapped. The map (if shown) shows your location.

**Bad:** Battery % doesn't update, lock/unlock button doesn't respond, "End rental" button is missing, map is blank.

### Step 5.6 — End rental
1. Tap "End rental"
2. Follow the prompts (return location, vehicle photos again, final odometer)

**Good:** Clear flow, the return photos save, the final cost / settlement is shown.

**Bad:** Crashes during end rental, settlement amount is "₹0" or "NaN", photos don't save, app doesn't show the return confirmation.

**Section 5 summary:** ✅ or 🐛. Critical section — anything broken here is a SEVERITY: HIGH bug.

---

## Section 6 — Wallet & transactions (~5 min)

This tests: balance display, transaction history, top-up flow (if you skipped Section 4).

### Step 6.1 — Wallet balance
1. From the dashboard, tap "Wallet" or look for a balance display

**Good:** Balance is clearly shown in ₹ (rupees), with proper formatting (₹1,234 not ₹1234). The "Top up" button is visible.

**Bad:** Balance is "0" (when you know it shouldn't be), balance is negative, "Top up" button missing, balance shows as "₹NaN".

### Step 6.2 — Transaction history
1. Tap "View all" or "Transaction history"

**Good:** List of transactions with: type (top-up / rental / deposit), amount, date, status. Newest at top.

**Bad:** Empty list (when you have transactions), transactions have no date, "₹undefined", status is blank.

### Step 6.3 — Filters
1. Look for filter buttons (e.g., "All / Top-up / Rentals / Refunds")

**Good:** Filters work — tapping a filter shows only matching transactions. The active filter is highlighted.

**Bad:** Filters don't work, multiple filters can be active, no visual indication of which is selected.

**Section 6 summary:** ✅ or 🐛.

---

## Section 7 — Support & FAQ (~5 min)

This tests: support center, FAQ, troubleshooter, ticket creation.

### Step 7.1 — Support center
1. From the dashboard, tap "Support" or "Help"

**Good:** You see options: "FAQ", "Contact us", "Troubleshooter", "Create ticket", and possibly a "Quick Help checklist" or "Common issues" section.

**Bad:** Options are missing, screen is blank, "Contact us" is a dead link, the checklist (if present) is empty.

### Step 7.2 — FAQ
1. Tap "FAQ"
2. Expand a question

**Good:** Questions are clearly listed. Tapping expands the answer. The text is readable.

**Bad:** Questions are tiny (less than 12px), expanding doesn't work, answer is missing or cut off.

### Step 7.3 — Troubleshooter
1. Tap "Troubleshooter"
2. Pick a category (e.g., "Battery")

**Good:** Decision-tree questions lead you through troubleshooting. Each step has clear "Yes / No" buttons.

**Bad:** Crashes, gets stuck in a loop, no way to go back, buttons are too small.

### Step 7.4 — Create ticket
1. Tap "Create ticket"
2. Fill in subject + description
3. Tap "Submit"

**Good:** Form is clear, submission succeeds, you get a ticket number, you see a success message.

**Bad:** Can't type in fields, "Submit" doesn't work, no success message, ticket number is "null".

**Section 7 summary:** ✅ or 🐛.

---

## Section 8 — Profile & settings (~5 min)

This tests: profile display, edit profile, app settings, legal, emergency SOS, emergency contacts.

### Step 8.1 — Profile display
1. From the dashboard, tap your name / avatar / "Profile"

**Good:** You see your name, photo, phone, email, KYC status.

**Bad:** Photo is missing, KYC status is "Unknown" or "null", name shows as "User".

### Step 8.2 — Edit profile
1. Tap "Edit" or a pencil icon
2. Change a field (e.g., your email)
3. Tap "Save"

**Good:** Save succeeds, the new value shows in the profile.

**Bad:** Save fails silently, the new value doesn't appear, app crashes on save, "Error 500" message.

### Step 8.3 — App settings
1. Tap "Settings"
2. Look for: theme (light/dark), biometric login (fingerprint), language, notifications

**Good:** Each setting has a toggle. Toggling actually changes the behavior (theme switches immediately, biometric prompt appears).

**Bad:** Toggles don't work, theme doesn't switch, biometric toggle doesn't trigger the fingerprint prompt.

### Step 8.4 — Legal pages
1. Tap "Legal" or "Terms"
2. Look for: Terms of Service, Privacy Policy, Refund Policy

**Good:** Each document opens with full text. Text is readable.

**Bad:** Documents are blank, "Coming soon" placeholder, broken links.

### Step 8.5 — Emergency SOS
1. From the dashboard or settings, look for "Emergency SOS" or "SOS"
2. **DON'T actually trigger it** — just check the button is there and tappable

**Good:** A red SOS button is visible (often a banner at the top of the dashboard). Tapping it shows a confirmation dialog ("Are you sure?") and then a list of emergency contacts.

**Bad:** SOS button is missing, tapping crashes, no confirmation dialog, "Contact 112" doesn't work.

### Step 8.6 — Emergency contacts
1. Find "Emergency contacts" in profile or settings
2. Add a fake contact (your own number, since this is test data)

**Good:** Contact saves, appears in the list, can be deleted.

**Bad:** Can't add, contact doesn't appear after saving, no delete option.

**Section 8 summary:** ✅ or 🐛.

---

## Section 9 — Notifications & engagement (~5 min)

This tests: in-app notifications, rewards, referrals.

### Step 9.1 — Notifications
1. From the dashboard, tap a bell icon or "Notifications"
2. Look at the list of notifications

**Good:** Each notification has: title, description, time, icon. Tapping opens the relevant screen.

**Bad:** No notifications listed, all notifications have no text, "Error" placeholders, can't tap.

### Step 9.2 — Rewards
1. From dashboard or settings, find "Rewards"
2. Look at the rewards screen

**Good:** Shows available rewards, points balance, history.

**Bad:** Empty screen, points show as "0" when you have some, no clear "redeem" flow.

### Step 9.3 — Referral
1. Find "Refer a friend" or "Referral"
2. Look for a referral code + share button

**Good:** You see a referral code, can copy it, can share via WhatsApp / SMS.

**Bad:** No code, share button missing, code is "null".

**Section 9 summary:** ✅ or 🐛.

---

## Section 10 — Edge cases & stress tests (~10 min)

This tests: app behavior in unusual conditions.

### Step 10.0 — Workflow & Services hub (home screen)
1. From the dashboard, look for a "Services" or "Workflow" tab/section that lists everything you can do in the app (Plans, Top-up, Pickup, Support, etc.)
2. Tap each item to make sure it goes to the right screen

**Good:** Every item on the hub takes you to a working screen. Items are clearly labeled. The hub loads in under 2 seconds.

**Bad:** Some items lead to a 404 or blank screen. An item says "Coming soon" with no ETA. The hub takes more than 3 seconds to load.

### Step 10.1 — Backgrounding
1. Open the app
2. Press the home button (don't close the app, just send to background)
3. Wait 30 seconds
4. Tap the Voltium icon to come back

**Good:** You return to where you were. No data loss.

**Bad:** App restarts from splash, you're logged out, blank screen.

### Step 10.2 — Airplane mode
1. Turn on airplane mode
2. Try to do something that needs network (load dashboard, refresh wallet)

**Good:** A clear "No internet" message or an offline indicator. The app doesn't crash.

**Bad:** App crashes, infinite spinner, no message at all.

### Step 10.3 — Turn off airplane mode
1. Turn airplane mode off
2. Try the same action again

**Good:** The app recovers automatically (data loads). No need to force-quit.

**Bad:** Stuck even after network is back, requires force-quit + reopen.

### Step 10.4 — Rotation
1. Open the app
2. Rotate the device from portrait to landscape (and back)

**Good:** The app handles rotation smoothly. No layout breaks, no data loss.

**Bad:** Layout breaks (text overlaps, buttons off-screen), app crashes on rotation, content disappears.

### Step 10.5 — Back button
1. Navigate 2-3 screens deep
2. Press the Android back button

**Good:** You go back one screen at a time. Eventually you return to the dashboard or the app exits cleanly.

**Bad:** Back button does nothing, exits the app immediately, goes to the wrong screen.

### Step 10.6 — Logout
1. From settings or profile, tap "Logout"
2. Confirm if there's a prompt

**Good:** You're returned to the login screen. Personal data is cleared (your name, wallet, etc. are not visible without logging in again).

**Bad:** Stuck, crash, you can still see your data after logout (security bug!), back button doesn't work after logout.

**Section 10 summary:** ✅ or 🐛.

---

# Wrapping up

## What to do at the end

1. **Force-quit the app** (so it starts fresh next time)
2. **Open your notes** — count the 🐛 issues you found
3. **For each 🐛**, fill out a bug report using `docs/BUG_REPORT_TEMPLATE.md` (one bug per template)
4. **Send the bug list to the dev team** — they will file tickets, prioritize, and fix

## How to prioritize bugs

The dev team wants to know:
- **CRASH:** App closes / freezes / shows a white screen. **Always report these first.**
- **BROKEN:** A feature doesn't work at all (e.g., can't add emergency contact).
- **WRONG:** Something shows the wrong info (e.g., wrong balance, wrong name).
- **UGLY:** Visual issues (text too small, color wrong, button in weird place).
- **SLOW:** App is slow to load or respond (takes more than 3 seconds for a screen).

In your bug list, **sort by CRASH first, then BROKEN, then WRONG, then UGLY, then SLOW.**

## What NOT to file as a bug

- **Things that are by design** (e.g., "I want a dark mode toggle" — that's a feature request, not a bug)
- **Things outside the app** (your phone's battery, your Wi-Fi being slow — unless you can show it's the app's fault)
- **Things you've already reported** (search your notes first)

## How often to do this

- **Once a week** is good during active development
- **Before every release** is mandatory
- **After any big change** to the app (the dev team should tell you when)

If you do this every week, you'll find regressions the moment they happen, not three weeks later when someone notices in production.

---

## Quick reference — what each screen should look like

| Screen | Look for | Likely problems |
|--------|----------|-----------------|
| Splash | Logo + "Voltium" text, 1-3 sec | Black screen, crash, hangs |
| Legal | Scrollable terms, Agree button | Text cut off, button too small |
| Permissions | 4-6 permission cards, Allow buttons | Crashes, missing buttons |
| Login | Phone field, country code, Send OTP | Can't delete, no country code |
| OTP | 6 boxes, auto-advance, Verify button | No auto-advance, no Verify |
| Dashboard | Name, balance, "Start rental" button | Balance is "0" or "NaN" |
| Choose plan | 2-4 plans with prices | No prices, no "Best value" badge |
| Top-up | Suggested amounts, Pay button | Keyboard covers Pay button |
| Pickup hub | Hub list with distances | Empty list, no "Select" button |
| Vehicle photos | Camera works, thumbnails save | Crashes, photos invisible |
| Active dashboard | Battery %, lock/unlock, map | Battery stuck at 0%, map blank |
| End rental | Return photos, settlement | Settlement is ₹0, crashes |
| Wallet | Balance, "Top up" button | Balance is NaN, no button |
| Transactions | Date, type, amount | "₹undefined", no date |
| Support | FAQ, Contact, Ticket options | "Contact" is dead link |
| Profile | Photo, name, KYC status | Photo missing, status "Unknown" |
| Settings | Theme, biometric toggles | Toggles don't work |
| Notifications | List with title + time | "Error" placeholders |
| SOS | Red button, confirmation dialog | No confirmation, crashes |

**Print this table and keep it next to you while you test.** It saves time when you forget what "good" looks like for a given screen.

---

## What to do if you find a CRASH

1. **Reopen the app** — sometimes crashes are one-off
2. **If it crashes again on the same action:** this is a real bug
3. **Take a screenshot** of whatever was on screen before the crash (if you can)
4. **Note the exact action** that triggered it: "I was on the Wallet screen, tapped 'Top up', and the app closed"
5. **Set the bug severity to CRASH** in your notes
6. **Send to dev team immediately** — don't wait until the end of the test

## What to do if you find something the dev team already knows about

Some bugs might be in the "Known Issues" list (`docs/KNOWN_ISSUES.md`). Check that doc first. If it's listed, don't re-file — just note "Already known" in your notes.

---

## That's it.

You have everything you need. Take the playbook, your phone, and ~90 minutes. Come back with a list of bugs sorted by severity. The dev team will take it from there.

If anything in this playbook is unclear or you find a flow that's not covered, ping me and I'll update it.
