# PR #4 — Empty States: Device Test Script

**Tester:** Voltium (physical device)
**Build:** Any build with PR #4 (`feat/ux-3-empty-states`) merged
**Goal:** Verify the 6 list-empty screens render a friendly, branded empty
state with primary CTA where relevant, instead of a bare italic Text.

---

## Before you start

1. Install the build on a fresh device (or `flutter clean` + reinstall).
2. Log in as a **brand-new rider** (no wallet activity, no tickets, no notifications).
   Easiest: register a new phone number that has never been used.
3. Have a **second device / account** ready that *does* have wallet history
   and tickets, so you can also test the "search returns nothing" case.

---

## Test matrix (6 screens, 2 personas)

| # | Screen | Empty case | New CTA |
|---|---|---|---|
| 1 | Wallet → Transactions (in-wallet list) | New rider, filter = "All" | "Top up wallet" |
| 2 | Wallet → History (search-filtered) | New rider, type a search that matches nothing | _(none)_ |
| 3 | Support → Center → Tickets tab | New rider | "Create ticket" |
| 4 | Support → FAQ (search-filtered) | Type a search that matches nothing | _(none)_ |
| 5 | Notifications (any tab) | New rider | _(none)_ |
| 6 | Pickup → Vehicle search sheet | Type a search that matches nothing | _(none)_ |

---

## For each screen, check these 6 things

1. **Icon** — A 96×96 Voltium-Blue-tinted circle with the right Material icon
   (wallet, filter, ticket, search, bell-tab, moped). Not a flat outline icon.
2. **Title** — Short, sentence case, ~3-5 words. Reads naturally out loud.
3. **Subtitle** — One line, explains *what to do next* ("Try a different
   filter…", "Anything you raise with support will appear here…"). Not a
   technical error string.
4. **CTA button** (where present) — Voltium Blue, pill-shaped (AppRadius.full),
   label matches the test matrix. Tap it → it navigates to the right place.
5. **Vertical centering** — The empty state is centered in the available
   viewport, with ~48px of padding above and below. Not pinned to the top.
6. **Dark mode** — Flip the device to dark mode (Settings → Display). The
   icon circle stays Voltium Blue, the title is white-ish, the subtitle is
   muted gray. No black-on-black or white-on-white.

---

## Specific scenarios

### #1 — Wallet transactions (new rider, no top-up)
1. Open the app as a brand-new rider.
2. Tap the **Wallet** tab. Scroll to the transactions list.
3. **Expected:** 96×96 Voltium-Blue circle with a wallet icon, title
   "No transactions yet", subtitle "Your wallet activity will show up here
   once you top up or make a payment.", and a **"Top up wallet"** button.
4. **Tap the CTA.** The Top Up flow should open.
5. **Switch filter** to "Credits" or "Debits". Since the list is still empty,
   the icon should change to `filter_list_off_rounded`, title becomes
   "No matching transactions", subtitle becomes "Try a different filter to
   see more results.", and the CTA should disappear (no nav target).

### #2 — Wallet history (search returns nothing)
1. As a rider *with* transactions, open Wallet → "See all" → History.
2. Type a long random string in the search box (e.g. "zzzqqq999").
3. **Expected:** Search filters down to zero results. The empty state shows
   a filter-off icon, title "No transactions found", subtitle "Try a
   different filter or search term to see your wallet history." No CTA.

### #3 — Support tickets (new rider)
1. As a brand-new rider, open Support → Center.
2. **Expected:** Tickets list area shows a ticket-outline icon, title
   "No tickets yet", subtitle "Anything you raise with support will appear
   here. Need a hand? Start a new ticket.", and a **"Create ticket"** button.
3. **Tap the CTA.** The Create Ticket screen should open.

### #4 — FAQ (search returns nothing)
1. Open Support → Center → "FAQs" tile (or wherever the FAQ entry is).
2. Type a string that matches no FAQ (e.g. "blarghxyz").
3. **Expected:** Search-off icon, title "No results found", subtitle
   "We couldn't find any FAQ matching your search. Try a different word,
   or scroll up to use the 'Create ticket' button." No CTA on the empty
   state itself (the Create Ticket button lives elsewhere on the screen).

### #5 — Notifications (any tab)
1. As a brand-new rider, tap the bell / Notifications tab.
2. **Expected:** The empty state shows the **bell icon for the active tab**
   (so: bell for "All", payment icon for "Payments", document icon for "KYC",
   wrench for "Maintenance", megaphone for "Announcements"). Title reads
   "No {tab} notifications" (lowercased), subtitle "You're all caught up!
   Updates from Voltium will appear here."
3. **Switch tabs.** The icon should follow the active tab. The title should
   update too.

### #6 — Pickup vehicle search (no match)
1. As a rider with an active pickup flow, open the vehicle picker sheet.
2. Type a string that matches no vehicle number/ID.
3. **Expected:** Moped icon, title "No vehicles match", subtitle "Try a
   different search term, or check back once more vehicles are available
   at your hub." No CTA (no nav target makes sense here).

---

## What to look for (red flags — file a bug, don't pass)

- **Hard-coded English-only error** like "null check operator used" or a
  stack trace visible. Means a widget threw an exception in build.
- **White square / black square / wrong color.** The Voltium Blue should
  be `#0053C1`. If it's a generic Material blue, theme is off.
- **CTA button doesn't navigate.** Tapping "Top up wallet" should land on
  the Top Up screen within 1s.
- **Text clipping / overflow.** Long device text-size settings (Settings →
  Display → Font size → Largest) should still wrap, not get cut off.
- **Layout shift on rotation.** Rotate the device portrait ↔ landscape —
  the empty state should re-center cleanly, not jump.

---

## Sign-off

If all 6 screens pass on the new rider + all 6 "search returns nothing"
scenarios also pass on a real-data rider, mark the PR **device-passed**
in the PR comment with: "PR #4 — 6/6 screens pass device test (empty states
only — loading + error widgets land in PR #3 and PR #6)."

If any of the 6 things in the per-screen checklist above fail, file a
bug with the screen name + which numbered check failed + a screenshot.
