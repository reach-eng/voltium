# Voltium — Bug Report Template

**Date:** 2026-07-29
**For:** Physical tester (you) → dev team
**Goal:** Give the dev team a bug they can fix in 1 minute, not 30 minutes of back-and-forth.

---

## How to use this

For every bug you find using the `DEVICE_TEST_PLAYBOOK.md`, copy the template below, fill it in, and send it to the dev team (email, Slack, GitHub issue — whatever channel they prefer).

**One bug per template.** Don't combine multiple bugs into one report.

**Be specific.** "The app is broken" is useless. "The wallet balance shows ₹0 after I paid ₹500 via UPI" is actionable.

**Include screenshots.** A picture saves 1000 words. Use your phone's screenshot button (Power + Volume Down on most Androids).

---

# Bug Report — [Short description of the bug]

> **Example:** "Wallet balance shows ₹0 after a successful UPI top-up"
> **Example:** "App crashes when I tap the End Rental button"
> **Example:** "Login screen phone field doesn't accept my number"

## Severity
Pick one:
- [ ] **CRASH** — App closes, freezes, or shows a white screen
- [ ] **BROKEN** — A feature doesn't work at all
- [ ] **WRONG** — Something shows incorrect information
- [ ] **UGLY** — Visual issue (text too small, color wrong, layout broken)
- [ ] **SLOW** — App takes more than 3 seconds to load or respond

## Device
- **Phone model:** (e.g. "Pixel 7", "Samsung Galaxy A52", "OnePlus 9")
- **Android version:** (e.g. "Android 14", "Android 13")
- **App version:** (Find in Settings → Apps → Voltium → scroll to bottom — or ask dev team)
- **Build flavor:** (dev / staging / production — ask dev team if unsure)

## When does this happen?

> Describe the exact steps to reproduce the bug. The dev team should be able to follow your steps and see the same bug.

1. (e.g. "I opened the app")
2. (e.g. "I tapped 'Wallet'")
3. (e.g. "I tapped 'Top up'")
4. (e.g. "I picked '₹500'")
5. (e.g. "I completed the UPI payment in PhonePe")
6. (e.g. "I tapped 'Back to wallet' in the app")
7. (e.g. "The wallet balance shows ₹0 instead of ₹500")

## What did you expect to happen?

> Describe what should have happened if the app was working correctly.

(e.g. "I expected the wallet to show ₹500 because I just paid that amount.")

## What actually happened?

> Describe what you actually saw. Include the exact text of any error messages.

(e.g. "The balance showed ₹0. No error message. I refreshed and it was still ₹0. I restarted the app and it was still ₹0. I waited 5 minutes and checked again — still ₹0.")

## Screenshots / video

> Attach 1-3 screenshots showing the bug. If the bug is a crash, take a screenshot just before the crash if possible.

- ![Description of screenshot 1](attachment_url_or_local_path)
- ![Description of screenshot 2](attachment_url_or_local_path)

## How often does this happen?

> Does it happen every time, sometimes, or only once?

- [ ] **Every time** — happens 100% of the time when I follow the steps
- [ ] **Sometimes** — happens maybe half the time, or under certain conditions
- [ ] **Once** — happened once, I haven't been able to reproduce

If "sometimes", describe when: (e.g. "Only happens when I'm on mobile data, not Wi-Fi" / "Only happens if I have 2+ notifications" / "Only happens after I leave the app for 10+ minutes")

## Does this block you from using the app?

> Critical for the dev team to know how urgently to fix it.

- [ ] **Yes — I can't use the app at all** (e.g., can't log in, can't start a rental)
- [ ] **Yes — I can't use one specific feature** (e.g., can't top up, but everything else works)
- [ ] **No — the app still works, but this is annoying**

## Anything else?

> Anything else the dev team should know. Examples:
> - "I had a similar bug last week, but I didn't report it"
> - "This only started happening after the latest app update"
> - "I tried on a different device and it didn't happen there"
> - "I'm using the test account the dev team gave me"

---

# Quick reference — what to put in each field

| Field | What to write | Example |
|-------|---------------|---------|
| **Title** | One-line description, can be a sentence | "Wallet shows ₹0 after UPI top-up" |
| **Severity** | CRASH > BROKEN > WRONG > UGLY > SLOW | CRASH |
| **Phone** | Model name, findable in Settings → About | Pixel 7 |
| **Android** | Version, findable in Settings → About → Android version | Android 14 |
| **App version** | Number, findable in Settings → Apps → Voltium | 0.2.0+156 |
| **Build flavor** | Ask dev team once, fill in for all future bugs | dev |
| **Steps** | Numbered list, "tap X, see Y" | "1. Open app 2. Tap Wallet..." |
| **Expected** | What should have happened | "Balance should show ₹500" |
| **Actual** | What really happened (include error text) | "Balance shows ₹0, no error" |
| **Screenshots** | 1-3 images showing the bug | Screenshot of wallet screen |
| **Frequency** | Every time / sometimes / once | Every time |
| **Blocks app?** | Yes all / Yes one feature / No | Yes one feature (top-up) |

---

# Examples of good bug reports

## ✅ Good example 1 (crash)

**Title:** App crashes when I tap "End Rental" on the active dashboard

**Severity:** CRASH

**Device:** Samsung Galaxy A52, Android 13, app version 0.2.0+156, dev build

**Steps:**
1. I started a rental (vehicle VR-TEST-001)
2. I rode for ~5 minutes
3. I tapped "End rental" on the active dashboard
4. The app closed immediately

**Expected:** The app should show a confirmation dialog ("Are you sure you want to end the rental?") and then a return flow.

**Actual:** The app closed with no warning. When I reopened it, the rental was still active (I could see it on the dashboard). I had to force-quit twice to get back in.

**Screenshots:** Screenshot of the active dashboard right before the crash, screenshot of the app icon on the home screen after the crash.

**Frequency:** Every time. I tried 3 times.

**Blocks app?** Yes — I can't end rentals.

**Anything else:** This started happening after the latest app update (yesterday).

## ✅ Good example 2 (wrong info)

**Title:** Wallet balance shows ₹NaN after a partial refund

**Severity:** WRONG

**Device:** Pixel 7, Android 14, app version 0.2.0+156, dev build

**Steps:**
1. I had a wallet balance of ₹1000
2. I requested a partial refund of ₹200 from the dev team
3. They confirmed the refund was processed in the admin panel
4. I opened the app and went to the Wallet screen
5. The balance shows "₹NaN" instead of "₹800"

**Expected:** The balance should show ₹800 (₹1000 - ₹200 refund).

**Actual:** The balance shows "₹NaN". I tried refreshing (pulled down on the screen), restarted the app, and waited 10 minutes — still shows "₹NaN".

**Screenshots:** Screenshot of the wallet screen showing "₹NaN".

**Frequency:** Every time. Hasn't gone away.

**Blocks app?** No — I can still do other things, but I don't trust the balance.

## ❌ Bad example 1 (vague)

**Title:** App is broken

**Severity:** ?

**Steps:** I tried to do something and it didn't work.

**Expected:** It should work.

**Actual:** It didn't.

> This is useless. The dev team has no idea what's broken, where, or how to reproduce it. **Always include specific steps and screenshots.**

## ❌ Bad example 2 (only opinion)

**Title:** The design is ugly

**Severity:** UGLY

**Steps:** I opened the app.

**Expected:** It should look better.

**Actual:** It looks bad.

> This is a design preference, not a bug. **A bug is something that doesn't match the design spec, or doesn't work, or shows wrong info.** "Ugly" is OK as a severity if you can describe what's wrong (e.g., "text is too small to read", "button is hidden by the keyboard", "two elements overlap").

---

# What happens after you file a bug

1. **Dev team triages** — they decide if it's CRASH (fix now), BROKEN (fix this sprint), WRONG (fix this sprint or next), UGLY (backlog), SLOW (backlog)
2. **Dev team files a ticket** in their internal system (or in this repo)
3. **Dev team fixes it** — usually within a few days for CRASH/BROKEN, longer for others
4. **Dev team asks you to re-test** — they'll send you a new build with the fix
5. **You re-test** — open the new build, follow your original steps, see if it's fixed
6. **You confirm or push back** — "Fixed, thanks" or "Still broken, here's a new screenshot"

This is a loop. The faster you can go around it, the faster the app gets better.

---

# Common mistakes to avoid

- **Don't combine bugs.** "Three things broke today" is harder to fix than three separate reports.
- **Don't assume you know the cause.** "I think the database is wrong" — that's the dev team's job to figure out. Just describe what you see.
- **Don't skip screenshots.** Even if the bug seems obvious, a screenshot removes all doubt.
- **Don't file duplicates.** Check `docs/KNOWN_ISSUES.md` first. If it's listed, don't re-file.
- **Don't wait until the end of the week to report a CRASH.** Send CRASH bugs the moment you find them.

---

# Quick-start checklist

Before you file a bug, make sure you have:
- [ ] A clear one-line title
- [ ] Severity (CRASH / BROKEN / WRONG / UGLY / SLOW)
- [ ] Device + Android version + app version
- [ ] Numbered steps to reproduce
- [ ] "Expected" vs "Actual" (in plain language)
- [ ] At least one screenshot
- [ ] Frequency (every time / sometimes / once)
- [ ] Whether it blocks app usage

If you have all 8, file it. The dev team can work with it. If you're missing more than 2, you probably need to re-test and gather more info first.
