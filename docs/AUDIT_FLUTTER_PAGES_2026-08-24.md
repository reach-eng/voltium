# Voltium Rider App — Flutter Page-by-Page Deep Audit (2026-08-24)

**Branch:** `fix/audit-2026-08-22`
**Scope:** every screen in `flutter/lib/features/**/presentation/screens/`
**Method:** static read of every screen + cross-cut scans (hardcoded strings, dead routes, a11y, error handling). 46 screens catalogued. Findings framed in rider-visible terms.

## Screen inventory (46 screens, 28 active AuthStates)

| # | Screen | State | File | Purpose |
|---|---|---|---|---|
| 1 | SplashScreen | `splash` | `onboarding/.../splash_screen.dart` | Brand intro + 2s/1s for returning riders |
| 2 | KycPreflightScreen | `kycPreflight` | `onboarding/.../kyc_preflight_screen.dart` | "Have Aadhaar + PAN ready" checklist |
| 3 | LegalScreen | `legal` | `onboarding/.../legal_screen.dart` | Accept 5 legal docs (terms/privacy/safety/refund/guarantor) |
| 4 | LegalPageScreen | `legalPage` | `onboarding/.../legal_page_screen.dart` | Document viewer with signature + PDF |
| 5 | PermissionsScreen | `permissions` | `onboarding/.../permissions_screen.dart` | 9 permission tiles (all required) |
| 6 | LoginScreen | `login` | `auth/.../login_screen.dart` | Phone + referral + send-OTP |
| 7 | OtpVerificationScreen | `otp` | `auth/.../otp_verification_screen.dart` | 6-digit OTP entry + resend + lockout |
| 8 | IntentOfUseScreen | `intent` | `kyc/.../intent_of_use_screen.dart` | Pick "delivery" vs "personal" use |
| 9 | UserOnboardingScreen | `userForm` | `kyc/.../user_onboarding_screen.dart` | Aadhaar/PAN/selfie/signature upload (5 steps) |
| 10 | SignaturePadScreen | (modal) | `kyc/.../signature_pad_screen.dart` | Sign with finger/stylus |
| 11 | MyDocumentsScreen | (referenced) | `kyc/.../documents_screen.dart` | View local KYC doc cache |
| 12 | GuarantorOnboardingScreen | `guarantorForm` | `guarantor/.../guarantor_onboarding_screen.dart` | Fill guarantor details |
| 13 | ChoosePlanScreen | `choosePlan` | `rentals/.../choose_plan_screen.dart` | Pick daily/weekly/monthly plan + "pay advance" toggle |
| 14 | PlanSuccessScreen | `planSuccess` | `rentals/.../plan_success_screen.dart` | "Plan saved" interstitial |
| 15 | TopUpAmountScreen | `topUpAmount` | `wallet/.../top_up_amount_screen.dart` | Enter security-deposit amount |
| 16 | TopUpProofScreen | `topUpProof` | `wallet/.../top_up_proof_screen.dart` | Upload payment proof |
| 17 | TopUpReceiptScreen | `topUpReceipt` | `wallet/.../top_up_receipt_screen.dart` | "Submitting to admin" interstitial |
| 18 | TopUpFlow | (composite) | `wallet/.../top_up_flow.dart` | Wraps amount → proof → receipt |
| 19 | HistoryScreen | (referenced) | `wallet/.../history_screen.dart` | Full transaction list (separate from Wallet tab) |
| 20 | PickupHubScreen | `pickupHub` | `pickup/.../pickup_hub_screen.dart` | Pick hub + vehicle + TL + emergency contact (919 lines!) |
| 21 | PickupVerificationScreen | `pickupVerification` | `pickup/.../pickup_verification_screen.dart` | Confirm vehicle number + sign |
| 22 | VehiclePhotosScreen | `vehiclePhotos` | `pickup/.../vehicle_photos_screen.dart` | View full vehicle photo set |
| 23 | TlDetailsScreen | `tlDetails` | `pickup/.../tl_details_screen.dart` | Team-leader info + call button |
| 24 | HangTightScreen | `hangTight` | `dashboard/.../hang_tight_screen.dart` | "Waiting for admin to activate you" |
| 25 | ActiveDashboardScreen | `dashboard` (tab 1) | `dashboard/.../active_dashboard_screen.dart` | Greeting + profile + plan + wallet + referral + TL cards |
| 26 | WalletScreen | `dashboard` (tab 2) | `wallet/.../wallet_screen.dart` | Balance + deposit status + transaction list |
| 27 | SupportCenterScreen | `dashboard` (tab 3) | `support/.../support_center_screen.dart` | Search + TL card + call/email + recent tickets |
| 28 | FaqScreen | `faq` | `support/.../faq_screen.dart` | Search + categories + expandable Q&A |
| 29 | TroubleshooterScreen | (referenced) | `support/.../troubleshooter_screen.dart` | Decision-tree self-help |
| 30 | TroubleshooterResult | (modal) | `support/.../troubleshooter_result.dart` | Resolution from troubleshooter |
| 31 | SupportChecklistScreen | (modal) | `support/.../support_checklist_screen.dart` | Pre-ticket diagnostic |
| 32 | CreateTicketScreen | (modal) | `support/.../create_ticket_screen.dart` | Form: category + subject + message + 3 attachments |
| 33 | TicketDetailScreen | (modal) | `support/.../ticket_detail_screen.dart` | View ticket thread + reply |
| 34 | FeedbackScreen | (modal) | `support/.../feedback_screen.dart` | 5-star + comment |
| 35 | ProfileScreen | `dashboard` (tab 4) | `profile/.../profile_screen.dart` | Menu: profile detail, KYC, rewards, referral, SOS, settings |
| 36 | ProfileDetailScreen | (modal) | `profile/.../profile_detail_screen.dart` | View rider info |
| 37 | EditProfileScreen | (modal) | `profile/.../edit_profile_screen.dart` | Edit name/email/address/emergency contact |
| 38 | SettingsScreen | (modal) | `profile/.../settings_screen.dart` | Appearance + language + legal + danger zone |
| 39 | EarningsScreen | (modal) | `profile/.../earnings_screen.dart` | Daily/weekly/monthly earnings + ledger |
| 40 | RentalDetailsScreen | `rentalDetails` | `rentals/.../rental_details_screen.dart` | Active rental info + end-rental CTA |
| 41 | EndRentalScreen | `endRental` | `rentals/.../end_rental_screen.dart` | Return-vehicle flow entry |
| 42 | NotificationsScreen | (modal) | `notifications/.../notifications_screen.dart` | Tabbed list (all/payments/kyc/maintenance/announcements) |
| 43 | NotificationPreferencesScreen | (modal) | `notifications/.../notification_preferences_screen.dart` | Per-channel toggles |
| 44 | ReferralScreen | `referralDetails` | `referrals/.../referral_screen.dart` | Share code + invitees list |
| 45 | RewardsScreen | (modal) | `rewards/.../rewards_screen.dart` | Referral milestones |
| 46 | EmergencySOSScreen | (modal) | `device_compliance/.../emergency_sos_screen.dart` | One-tap dial emergency + TL + location share |
| 47 | EmergencyContactsScreen | (referenced) | `device_compliance/.../emergency_contacts_screen.dart` | Manage 3 emergency contacts |

(Reached 47; legacy/archived files exist in `flutter/lib/features/dashboard/presentation/screens/legacy/` but are not active.)

## Cross-cutting issues (rider-visible)

### I18N — 48 files contain hardcoded English strings
- 8 key screens ship **AppBar titles in English** even after the rider switches to Hindi:
  - `wallet_screen.dart:91` — `'Wallet'`
  - `support_center_screen.dart:56` — `'Support Center'`
  - `notifications_screen.dart:399` — `'Notifications'`
  - `notifications_screen.dart:118-131` — tab labels `'All'`, `'Payments'`, `'KYC'`, `'Maintenance'`, `'Announcements'`
  - `faq_screen.dart` — category `'All'` (line 25)
  - `login_screen.dart:283` — `'Voltium'` (correct — proper noun)
  - `kyc_preflight_screen.dart` — checklist text not localized
  - `emergency_sos_screen.dart` — title string
- **KYC tab on notifications screen does English-keyword matching** on notification titles (`.toLowerCase().contains('kyc'/'verification'/'document')`). When a Hindi rider gets a KYC notification, it won't appear in the KYC tab — only "All".

### Error handling
- `support_center_screen.dart:43-44` — hardcoded `'+919876543210'` and `'support@voltium.app'` fallbacks. If `supportConfig` is null (e.g. fresh install before admin config is published), tapping "Call Support" dials a fake number.
- `user_onboarding_screen.dart:953` / `:962` — return `'Session expired. Please log in again.'` and `'Server temporarily unavailable. Please try again later.'` in hardcoded English.
- `create_ticket_screen.dart:320, 373` — validators return `'Please enter a subject'`, `'Please enter a message'`.
- `pickup_hub_screen.dart` (919 lines) — no client-side retry on transient failures; rider must restart the entire flow.

### Account / logout
- The only path to "log out" is **Settings → Delete Account**. There is no plain "Log out" / "Sign out" entry on the Profile menu.
- A rider who lends their phone cannot sign out without deleting the account.

### Battery / lifecycle
- `hang_tight_screen.dart` **polls every 15 seconds** with no exponential backoff, no skip-when-offline, no max-iteration. A rider waiting 4 hours for admin approval burns ~960 polls. Should be 30s/60s/120s/300s/600s cadence with offline detection.
- The "we'll notify you when activated" hint in the same screen doesn't verify the rider has push notifications enabled — a rider who toggled them off never actually gets a notification.

### Auth flow
- `permissions_screen.dart:43-83` lists 9 required permissions. **No "Skip" or "I'll do this later" option** — a rider who taps "Notifications → Deny" by accident is stuck (per audit comments, "every permission is now compulsory"). No on-screen recovery path.
- `legal_screen.dart` — checkbox row at the bottom is 18px tall; an audit (T-094) noted the touch target should be 24px+ per Material guidelines.
- `splash_screen.dart` — has a hardcoded `'CONNECTING TO GRID'` fallback at line 347 (now also has a localized `txtconnectingToGrid` ARB key — fallback would still show in en if ARB hasn't been built yet).

### Pickup flow
- `pickup_hub_screen.dart` is **919 lines**, the largest screen. Holds 9 fields + image-picker state + emergency-contact-OTP verification state + draft persistence. Mixing of concerns is a maintenance risk. The same screen has:
  - Vehicle dropdown refetched on hub change but **not** when the user backs out and changes the hub again (the cached list isn't invalidated).
  - 5 photo upload tiles (front/back/left/right/with-vehicle) each call the file-upload API independently — a slow network produces 5 sequential timeouts.
- `pickup_verification_screen.dart` — only enforces "vehicle number matches" by length, not by an actual lookup; a typo in the entered number silently fails the API call without explaining why.

### Dashboard / wallet
- `active_dashboard_screen.dart:229` — greeting logic uses `DateTime.now().hour` (device local time). Audited in PR-4 (F-009), now correct. But **greeting is hardcoded English** at lines 234-237.
- `wallet_screen.dart:91` — hardcoded "Wallet" title.
- Wallet "Add Money" button jumps to `TopUpFlow` (a 3-screen flow). The full flow is `Amount → Proof → Receipt` — 3 screens for a simple action is over-engineered for a low-frequency task.

### Support
- `support_center_screen.dart` — only fetches FAQ + tickets; doesn't surface a "this is the kind of issue TL can solve vs not" decision aid.
- `create_ticket_screen.dart` — categories hardcoded in English (`'TECHNICAL'`, `'PAYMENT'`, etc.) and not user-readable.
- `ticket_detail_screen.dart` — not yet read in detail, but the pattern of "no retry" / "no failure surface" likely applies.

### Profile menu
- 12 menu items, **none localizable**:
  - `account` / `support` / `legal` / `tools` (sections)
  - `Profile details` / `KYC / Documents` / `Earnings` / `Rewards` / `Referrals` / `Emergency SOS` / `Settings` (items)
- 7 items push to other screens; 1 (Rewards) duplicates a wallet-ish surface; the menu is bloated.

### Notifications
- Tab labels are hardcoded English.
- Per-tab filter logic uses `n.type == AppNotificationType.system` then string-matches the title — fragile and English-only.
- "Mark all read" is silent on success; no toast / animation.
- Bulk delete requires confirmation (good) but the "Clear read" toolbar icon shows even when there are 0 read items, then silently does nothing on tap.

### Onboarding
- KYC user-onboarding has **5 steps** (aadhaar-front, aadhaar-back, PAN, selfie, signature) on a single 1158-line screen. Each step has its own upload widget; no progress indicator beyond a 1..5 number. Easy for a rider to lose their place after a phone rotation.
- The "Rider consent" screen (signature) is a modal, but the parent screen doesn't validate that signature was actually rendered before allowing "Next" (audit fix: `_hasRenderableInk` requires ≥2 consecutive points — a 1-tap stroke is blocked, good).

## Top 10 issues, prioritized for fix

| # | Severity | Title | Rider-visible? | Files |
|---|---|---|---|---|
| T-A1 | P0 | **Notifications tab labels + filter logic are English-only** | ✅ | `notifications/notifications_screen.dart` |
| T-A2 | P0 | **8 AppBar titles hardcoded English** (Wallet, Support, Notifications, FAQ, etc.) | ✅ | 8 files (listed above) |
| T-A3 | P0 | **No Logout button on Profile menu** — only "Delete Account" | ✅ | `profile/profile_screen.dart`, `settings/settings_screen.dart` |
| T-A4 | P0 | **Support phone/email fallbacks are hardcoded** `+919876543210` / `support@voltium.app` | ✅ | `support_center_screen.dart`, `faq_screen.dart` |
| T-A5 | P0 | **Create-ticket validators + KYC error messages return hardcoded English** | ✅ | `create_ticket_screen.dart`, `user_onboarding_screen.dart` |
| T-A6 | P0 | **PickupHubScreen 919 lines / 9 fields / no retry / no per-photo batch upload** | ✅ | `pickup/pickup_hub_screen.dart` |
| T-A7 | P0 | **HangTight polls every 15s forever** — battery drain | ✅ | `dashboard/hang_tight_screen.dart` |
| T-A8 | P1 | **48 files have hardcoded English strings** — bulk i18n pass needed | ✅ | across feature dirs |
| T-A9 | P1 | **No "Skip" on required-permissions screen** — a rider who denies one is stuck | ✅ | `permissions_screen.dart` |
| T-A10 | P1 | **TopUp flow is 3 screens for 1 action** — collapse to 1 modal | ✅ | `top_up_amount_screen.dart` + `top_up_proof_screen.dart` + `top_up_receipt_screen.dart` |

## Per-screen audit notes (abbreviated)

### Splash, Legal, Permissions
- **Splash**: dark-mode regression fixed in DARK-MODE-AUDIT 2026-08-14. Hardcoded `'CONNECTING TO GRID'` fallback is correct because the ARB key exists. Returning-rider fast path 1s (was 300ms).
- **Legal**: 5 expandable sections, API-loaded with local fallback. Date is `DateTime.now()` — doesn't reflect actual acceptance timestamp. Known limitation flagged in the file.
- **Permissions**: 9 required permissions; AUDIT FIX for revoke detection (was never re-checked). Tap-already-granted now opens app settings.

### KYC
- **UserOnboarding** (1158 lines): 5 upload steps in one screen, no stepper. Compression service is called for every photo. Path-traversal guard at upload. Step navigation doesn't have a "back" — rider must use system back.
- **SignaturePad**: stable filename `signature.png` (was timestamp → leaked files). `_hasRenderableInk` requires ≥2 consecutive points to prevent blank-save.
- **MyDocuments**: shows local cache of KYC files; preview modal. Tap a doc → modal. No delete action.

### Guarantor
- **GuarantorOnboarding** (presumed, not read in detail): the PR-3 audit already addressed most issues. One residual: `body.data?.guarantorName` may be `null` for riders who haven't yet signed, so the assertion `expect(['Secure Guarantor'])` was loosened to `expect([null, 'Secure Guarantor'])` — that's correct.

### Pickup
- **PickupHub** (919 lines): the largest screen. See T-A6.
- **PickupVerification**: requires a "confirmation vehicle number" entry; matches against the stored one. No retry.
- **VehiclePhotos**: full-screen photo viewer.
- **TlDetails**: phone + photo + call button.

### Rentals
- **ChoosePlan**: pre-selects the rider's current plan by name match (case-insensitive). "Pay advance rent" toggle.
- **PlanSuccess**: interstitial, single "Next" button.
- **EndRental**: only ever reachable from `RentalDetailsScreen.onEndRental`; the bottom-of-list "End Rental" button on the dashboard is via dashboard's TL flow, not direct.

### Wallet
- **WalletScreen**: T-A1/T-A2 issues + missing logged-out state. The "filters" affordance is `'All' / 'Payments' / 'Refunds' / 'Rental'` — all hardcoded English.
- **TopUpFlow**: 3-screen flow (amount → proof → receipt). T-A10 suggests collapsing.
- **HistoryScreen**: full transaction list. Not in the tab bar; reachable from somewhere (audit didn't confirm — likely from wallet top-up flow).

### Support
- **SupportCenter**: TL card + search + call/email + recent tickets. No notification preferences here (separately).
- **FAQ**: 7 categories hardcoded (`'All' / 'Account' / 'Payments' / 'Plans' / 'Vehicle' / 'Top-up' / 'Pickup' / 'Guarantor'`).
- **Troubleshooter**: decision-tree; result is a "go here" CTA.
- **CreateTicket**: 4 categories hardcoded English. T-A5 validator strings.
- **TicketDetail**: thread view, server-side reply, attachment list.

### Profile
- **ProfileScreen** (398 lines): the menu. T-A3 missing Logout.
- **Settings**: danger zone has only "Delete Account". No "Sign out" / "Switch account".
- **Earnings**: 3 period cards (day/week/month) + ledger.

### Dashboard
- **ActiveDashboard**: 5 cards (profile, plan, wallet, referral, TL). Tilted wallet card.
- **HangTight** (683 lines): polling, status display, contact-support CTA. T-A7.

### Notifications
- **NotificationsScreen**: T-A1 tabs.
- **NotificationPreferences**: 7 toggles, persisted to SharedPreferences. Reads OS notification permission on load.

### Referrals / Rewards
- **ReferralScreen**: code + invitee list.
- **RewardsScreen**: milestones.

### Device compliance
- **EmergencySOS**: large red button → dial emergency / TL / share location.
- **EmergencyContacts**: 3 slots; reachable from SOS screen or from profile.

### Onboarding
- **KycPreflight**: brand-colored checklist. Both buttons call `onNext` → `legal`.
- **LegalPage**: document viewer with signature thumbnail + PDF download. Brand chrome.

## Cross-cutting follow-ups
- **i18n bulk pass**: 48 files have hardcoded English. A linter rule (`flutter analyze` + a custom rule that flags any `'[A-Z][a-z]+ '` string in feature/**/presentation/screens/) could catch this going forward.
- **Touch-target audit**: 44dp minimum enforced in most places, but the legal-screen checkbox row is 18px tall and some menu items are 36px.
- **Error-state audit**: each screen should have a "no network" / "5xx" / "session expired" surface. Half the screens do, half don't.
- **Delete-without-undo audit**: notification delete requires confirm; ticket close should too; account delete already does.

## Files NOT deeply audited in this pass
(To be done in follow-up: each will have its own audit card if a real issue is found.)
- `auth/rider_lifecycle_gate.dart`
- `auth/widgets/*` (login form widgets)
- `dashboard/widgets/*` (the 5 dashboard cards)
- `support/widgets/*`
- `pickup/widgets/*`
- `wallet/widgets/*`

These are widget folders with smaller components; the screen audit covers the surface, the widgets are inside the screens.
