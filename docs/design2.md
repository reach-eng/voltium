# Voltium Rider App: Granular Screen Specifications (DESIGN2.md)

This document provides a detailed visual map and design specification for every screen in the Voltium Rider Flutter application. Each section details components, layout hierarchy, interaction patterns, and data bindings for all 47 screens.

---

## 1. Phase 1: Splash, Logic & Preamble

### 1.1 Splash Screen (`splash_screen.dart`)

- **Visual Map**: `Stack` -> `AnimatedBuilder` (Radial Pulse) -> `Center` (Hero Brand Mark).
- **Design Specs**: Primary gradient background; 120dp logo with white glow.
- **Interactions**: Auto-forward to `AuthWrapper` after 2.5s.
- **Data Binding**: Local check for `first_launch`.

### 1.2 Auth Wrapper (`auth_wrapper.dart`)

- **Visual Map**: Logical root widget (no direct UI); manages `StreamBuilder` for `AuthStatus`.
- **Interactions**: Transitions between `Login`, `Onboarding`, and `Dashboard` based on token & KYC state.
- **Data Binding**: Listens to `AppProvider.authStatus`.

### 1.3 Legal Screen (`legal_screen.dart`)

- **Visual Map**: `Column` -> `GlassCard` units for T&C, Privacy Policy, Rental Agreement.
- **Design Specs**: Backdrop blur (12px); Gradient checkbox (`primary` → `primaryLight`).
- **Interactions**: Checkbox enables "Proceed" button; Link tap launches system browser.
- **Data Binding**: Saves `legal_accepted: true`.

### 1.4 Permissions Screen (`permissions_screen.dart`)

- **Visual Map**: `ListView` -> Sequential Permission Cards (Location, Battery, Bluetooth, etc.).
- **Design Specs**: Circle avatars for icons; pill-shaped "Allow" buttons.
- **Interactions**: Triggers native Android/iOS dialogs via `permission_handler`.

### 1.5 Onboarding Screen (`onboarding_screen.dart`)

- **Visual Map**: `PageView` with smooth dot indicator.
- **Design Specs**: High-contrast illustrations; bold typography.
- **Interactions**: Swipe or tap "Next"; "Get Started" on final page sets `onboarding_complete`.

### 1.6 Auth Choice Screen (`auth_choice_screen.dart`)

- **Visual Map**: `Stack` background -> Bottom-anchored Buttons (Login, Sign Up).
- **Design Specs**: `AppGradients.primary` for primary button; ghost style for secondary.

---

## 2. Phase 2: Authentication flow

### 2.1 Login Screen (`login_screen.dart`)

- **Visual Map**: `H1` Title -> Phone Input field with country code -> "Get OTP" Button.
- **Design Specs**: Input background `#F5F7FA`; focus border `primary`.
- **Interactions**: 10-digit validation; tap-to-send OTP.
- **Data Binding**: `ApiService().sendOtp(phone)`.

### 2.2 OTP Verification Screen (`otp_verification_screen.dart`)

- **Visual Map**: 6-box `PinCodeTextField` -> Countdown Timer -> Resend Link.
- **Design Specs**: Error red state for invalid OTP; animated entry.
- **Interactions**: Auto-focus cycling; auto-submit on 6th digit.
- **Data Binding**: `ApiService().verifyOtp(phone, otp)`. Sets JWT in `AppProvider`.

---

## 3. Phase 3: Identity & Onboarding (KYC)

### 3.1 User Onboarding (KYC) (`user_onboarding_screen.dart`)

- **Visual Map**: `Stepper` -> 3 Stages: Profile, Aadhaar, PAN.
- **Design Specs**: Upload slots with dashed borders; photo preview thumbnails.
- **Interactions**: `ImagePicker` integration; real-time validation for ID numbers.
- **Data Binding**: POST multipart/form-data to `/kyc`.

### 3.2 Intent of Use (`intent_of_use_screen.dart`)

- **Visual Map**: Two large `ToggleCards` (Personal vs Delivery).
- **Design Specs**: Selected state has `primary` background and white text.
- **Interactions**: Single-tap selection.
- **Data Binding**: Updates `rider.intent`.

### 3.3 Guarantor Onboarding (`guarantor_onboarding_screen.dart`)

- **Visual Map**: Form (Name, Relation) -> Phone Verification -> Video Proof Upload.
- **Design Specs**: Video upload progress bar; red pulse on recording icon.
- **Data Binding**: Secondary OTP verification for guarantor phone.

### 3.4 Documents Screen (`documents_screen.dart`)

- **Visual Map**: Grid of uploaded document cards with status labels (Pending, Verified, Rejected).
- **Design Specs**: Color-coded badges for status.

---

## 4. Phase 4: Rental Activation Flow

### 4.1 Pre-Dashboard Screen (`pre_dashboard_screen.dart`)

- **Visual Map**: Checklist of 4 items: KYC, Deposit, Plan, Pickup.
- **Design Specs**: Large progress percentage at top.
- **Interactions**: Tapping a task launches its specific flow.

### 4.2 Choose Plan Screen (`choose_plan_screen.dart`)

- **Visual Map**: `PageView` or `List` of Plan Cards (Daily/Weekly/Monthly).
- **Design Specs**: "Most Popular" ribbon on Weekly plan.
- **Interactions**: Radio-card selection.

### 4.3 Plan Success Screen (`plan_success_screen.dart`)

- **Visual Map**: Full-screen success icon -> "Subscription Active" text -> "Go to Pickup" Button.
- **Design Specs**: `AppColors.success` background.

### 4.4 Pickup Hub Screen (`pickup_hub_screen.dart`)

- **Visual Map**: Hub selection list -> Emergency Contact verification field.
- **Interactions**: Emergency phone requires OTP verification on this screen.
- **Data Binding**: Fetches hubs from `/hub/all`.

### 4.5 Pickup Verification (`pickup_verification_screen.dart`)

- **Visual Map**: QR Scanner interface with camera overlay.
- **Interactions**: Scans Vehicle QR code or manual Entry.

### 4.6 Pickup Vehicle Screen (`pickup_vehicle_screen.dart`)

- **Visual Map**: Vehicle details card (Plate No, Model) -> "Start Inspection" Button.

### 4.7 Pickup Inspection (`pickup_inspection_screen.dart`)

- **Visual Map**: 4 Photo Slots + Odometer Reading input.
- **Design Specs**: Overlay guides for "Align front of vehicle here".

### 4.8 Pickup Success Screen (`pickup_success_screen.dart`)

- **Visual Map**: Animated celebration -> "Vehicle Assigned" -> "Go to Dashboard" Button.

---

## 5. Phase 5: Operational Dashboards & Details

### 5.1 Active Dashboard (`active_dashboard_screen.dart`)

- **Visual Map**:
  - `Top`: User Avatar, Notification Bell.
  - `Center`: Vehicle Card (Battery Gauge, Range in KM).
  - `BentoStats`: Total Distance, Today's Earnings, Ride Time.
- **Design Specs**: Battery bar turns red <15%; Glassmorphism for stats cards.
- **Interactions**: Pull-to-refresh; tap Battery for "Charging Hubs" link.
- **Data Binding**: WebSocket/Polling for IoT metrics.

### 5.2 Rental Details (`rental_details_screen.dart`)

- **Visual Map**: List of 6 key details: Vehicle ID, Plan Type, Start/End Dates, Remaining Days, Hub.
- **Interactions**: "End Rental" trigger; "Extend Plan" button.

### 5.3 Vehicle Photos Screen (`vehicle_photos_screen.dart`)

- **Visual Map**: Grid viewing of the 4 pickup inspection photos.

### 5.4 Team Leader (TL) Details (`tl_details_screen.dart`)

- **Visual Map**: TL Profile card -> Name, Contact Button, "Call TL".
- **Design Specs**: Blue "Call" icon button.

### 5.5 End Rental Screen (`end_rental_screen.dart`)

- **Visual Map**: Multi-step inspection: Final Odometer -> 4 Final Photos -> Confirmation.
- **Data Binding**: Finalizes rental session on server.

---

## 6. Phase 6: Wallet, Payments & Earnings

### 6.1 Wallet Screen (`wallet_screen.dart`)

- **Visual Map**: Balance Header -> "Top Up" Button -> "Recent Transactions" List.
- **Design Specs**: `AppGradients.primary` for balance card.

### 6.2 Top-up Purpose (`top_up_purpose_screen.dart`)

- **Visual Map**: Choice between "Wallet Balance" and "Security Deposit".

### 6.3 Top-up Amount (`top_up_amount_screen.dart`)

- **Visual Map**: Amount Input + Preset Chips (₹500, ₹1000, ₹2000).

### 6.4 Top-up UPI (`top_up_upi_screen.dart`)

- **Visual Map**: Copyable VPA (UPI ID) -> Payment Proof upload slot.
- **Interactions**: "Copy UPI ID" toast notification.

### 6.5 Top-up Receipt (`top_up_receipt_screen.dart`)

- **Visual Map**: "Verification Pending" status -> Transaction Details card.

### 6.6 History Screen (`history_screen.dart`)

- **Visual Map**: Tabbed list (All, Credits, Debits) -> Search bar -> Expandable Tx Cards.
- **Design Specs**: Red for Debit, Green for Credit.

### 6.7 Earnings Screen (`earnings_screen.dart`)

- **Visual Map**: Weekly Earnings Bar Chart -> Daily breakdown list.

---

## 7. Phase 7: Support & Safety

### 7.1 Support Center (`support_center_screen.dart`)

- **Visual Map**: Quick grid for Call, WhatsApp, Email -> "Recent Tickets" section.

### 7.2 Support Checklist (`support_checklist_screen.dart`)

- **Visual Map**: Step-by-step checklist "Did you check the side stand?", etc.
- **Interactions**: Must check all to proceed to troubleshooter.

### 7.3 Troubleshooter (`troubleshooter_screen.dart`)

- **Visual Map**: Decision tree UI (Questions & Answers).
- **Data Binding**: Driven by `troubleshooter_tree.dart`.

### 7.4 FAQ Screen (`faq_screen.dart`)

- **Visual Map**: Category tabs -> Search bar -> Expandable Q&A tiles.

### 7.5 Feedback Screen (`feedback_screen.dart`)

- **Visual Map**: Star rating widget -> Comment text field -> Category selection.

### 7.6 Emergency SOS (`emergency_sos_screen.dart`)

- **Visual Map**: Massive Red "HOLD SOS" button -> Pulsing animation.
- **Interactions**: 3-second hold to avoid accidental triggers.

### 7.7 Emergency Contacts (`emergency_contacts_screen.dart`)

- **Visual Map**: List of 5 contacts -> "Add Contact" FAB -> "Primary" toggle.

---

## 8. Phase 8: Profile & Rewards

### 8.1 Profile Screen (`profile_screen.dart`)

- **Visual Map**: Header (Avatar/Name) -> Bento Menu (Personal Info, Guarantor, Documents, Settings).

### 8.2 Edit Profile (`edit_profile_screen.dart`)

- **Visual Map**: Editable form fields for Email, Address -> Image Upload for avatar.

### 8.3 Referral Screen (`referral_screen.dart`)

- **Visual Map**: Referral Code Display -> Step-by-step "How it works" -> History.

### 8.4 Rewards Screen (`rewards_screen.dart`)

- **Visual Map**: Points Balance -> Active Streaks (Day 1, 2, 3...) -> Milestone cards.

---

## 9. Phase 9: Settings & Comms

### 9.1 App Settings (`app_settings_screen.dart`)

- **Visual Map**: General Toggles (Theme, Biometrics) -> Support Links -> Delete Account button.

### 9.2 Notification Center (`notification_center_screen.dart`)

- **Visual Map**: Consolidated list of all read/unread alerts.

### 9.3 Smart Notifications (`smart_notifications_screen.dart`)

- **Visual Map**: High-priority alert view (e.g., "Low Battery Reminder") with specific actions.

### 9.4 Notification Preferences (`notification_preferences_screen.dart`)

- **Visual Map**: Granular toggles for SMS, Push, Email across categories.

---

## 10. Phase 10: Special Logic & Misc

### 10.1 Pickup Inspection Success (`pickup_success_screen.dart`)

- **Visual Map**: Final confirmation of successful sync.

### 10.2 Vehicle Photos Viewer (`vehicle_photos_screen.dart`)

- **Visual Map**: Gallery view specifically for vehicle state tracking.
