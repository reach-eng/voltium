# Voltium Rider App: Technical Design Specification

This document serves as the absolute technical and visual reference for the Voltium Rider application. It details the global design system, the architecture of shared components, and a granular breakdown of all 47 screens.

---

## 1. Global Design System (Tokens)

The Voltium design language is a "Premium Operational" system that blends high-contrast readability with modern aesthetic layers (Mesh Gradients, Glassmorphism).

### 1.1 Color Architecture

| Token              | HEX                   | Usage                                                   |
| :----------------- | :-------------------- | :------------------------------------------------------ |
| `primary`          | `#0053C1`             | Brand identity, primary CTAs, active states.            |
| `primaryGradient`  | `#0053C1` → `#2F6DDE` | 135° angle for high-priority backgrounds.               |
| `surface`          | `#F7F9FB`             | Main application background (Light Mode).               |
| `surfaceAlt`       | `#F5F7FA`             | Authentication and Login backgrounds.                   |
| `onSurface`        | `#101828`             | Primary text, titles, and headers.                      |
| `onSurfaceVariant` | `#475467`             | Secondary text, captions, and muted descriptions.       |
| `success`          | `#10B981`             | Positive balances, "Verified" statuses, active rentals. |
| `warning`          | `#F59E0B`             | Overdue alerts, low battery warnings, pending KYCs.     |
| `error`            | `#EF4444`             | Suspended accounts, failed payments, SOS states.        |
| `inputBackground`  | `#E6EAEF`             | Background for "Pill" style inputs.                     |

### 1.2 Typography (Inter Stack)

The app uses [Inter](https://fonts.google.com/specimen/Inter) exclusively for its geometric clarity.

- **H1 (Header 1)**: 28px, Black (w900), -0.5px letter-spacing (e.g., App Name).
- **H2 (Title)**: 22px, ExtraBold (w800), -0.5px letter-spacing (e.g., Welcome screens).
- **H3 (Section Title)**: 18px, ExtraBold (w800) (e.g., Dashboard sections).
- **Body Large**: 15px, Bold (w700) (e.g., Button labels).
- **Body Medium**: 14px, Medium (w500) (e.g., Descriptions).
- **Caption**: 12px, Regular (w400) (e.g., Footer terms).
- **Overline**: 11px, Black (w900), 1.2px letter-spacing (e.g., "SECURE OTP" notes).

### 1.3 Interaction & Geometry

- **Radiuses**:
  - `sm`: 8px (Inputs, Small cards).
  - `xl`: 24px (Standard feature cards).
  - `full`: 9999px (Buttons, Avatar containers, Pill inputs).
- **Animations**:
  - `Entrance`: `FadeUpWidget` with `easeOutCubic` curve.
  - `Duration`: Normal (300ms) for transitions, Xslow (800ms) for entrance.
- **Shadows**:
  - `AppShadows.card`: `0px 24px 48px rgba(15,23,42,0.04)`.
  - `AppShadows.primaryButton`: `0px 8px 24px rgba(0,83,193,0.25)`.

---

## 2. Core Screen Catalog (Detailed)

### 2.1 Preamble & Global Routing

| Screen Name       | File Path                 | Detailed Component Breakdown                                                                                                                                                    |
| :---------------- | :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Splash Screen** | `splash_screen.dart`      | **Layout**: Centered Logo (72x72) in a `#0053C1` circle. Background uses `VoltMeshGradient`. <br>**Logic**: Authenticates session and routes to `LegalScreen` or `AuthWrapper`. |
| **Legal Screen**  | `legal_screen.dart`       | **Components**: Header with `BackdropFilter` (Blur 10), Scrollable HTML terms body, Sticky footer with "I Agree" button using `AppGradients.primary`.                           |
| **Permissions**   | `permissions_screen.dart` | **Components**: Sequential card stack. Each card features an Icon, Permission Name, and "Grant" button. Status updates in real-time using `AppState`.                           |
| **Onboarding**    | `onboarding_screen.dart`  | **UI**: PageView with 3 slides. Each slide contains a Lottie animation, H2 Title, and Body text. Page indicator uses active blue pill dots.                                     |
| **Auth Wrapper**  | `auth_wrapper.dart`       | **Logic**: A non-UI state machine that checks `isAuthenticated` and `pickupDone`. Redirects to Login, Pre-Dashboard, or Active Dashboard.                                       |

### 2.2 Authentication Engine

| Screen Name      | File Path                      | Detailed Component Breakdown                                                                                                                                                                                                       |
| :--------------- | :----------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Login Screen** | `login_screen.dart`            | **Header**: Centered Bolt Logo + "Voltium" (28px w900). <br>**Body**: Pill Input (Height 56, bg `#E6EAEF`) with `+91` prefix and `DigitsOnlyInputFormatter`. <br>**Buttons**: "Enter" Gradient button with `primaryButton` shadow. |
| **OTP Verify**   | `otp_verification_screen.dart` | **UI**: 4 individual square input boxes with `autoFocus` and `PinCodeField` behavior. Includes a "Resend OTP" countdown (60s) in `primary` blue.                                                                                   |
| **Auth Choice**  | `auth_choice_screen.dart`      | **UI**: Dual split-screen layout. Large "Sign In" and "Create Account" buttons with distinctive iconography.                                                                                                                       |

### 2.3 Registration & KYC Flow

| Screen Name         | File Path                          | Detailed Component Breakdown                                                                                                                                                  |
| :------------------ | :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User Onboarding** | `user_onboarding_screen.dart`      | **Form Elements**: Profile photo upload (CircleAvatar with Camera icon), Name, DOB, and Gender inputs. <br>**Validation**: Uses `Form` widget with regex for phone and email. |
| **Intent of Use**   | `intent_of_use_screen.dart`        | **UI**: Vertical list of 3 high-contrast cards: "Personal", "B2C Gigs", "B2B Delivery". Tapping a card triggers a subtle scale animation.                                     |
| **Guarantor Onbd.** | `guarantor_onboarding_screen.dart` | **Flow**: Identity document capture UI using `camera` and `image_picker`. Includes a secondary contact detail form.                                                           |

### 2.4 Pre-Active (Discovery & Acquisition)

| Screen Name       | File Path                   | Detailed Component Breakdown                                                                                                                                       |
| :---------------- | :-------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pre-Dashboard** | `pre_dashboard_screen.dart` | **Layout**: Hero area with "Discover Your Fleet". Empty state illustration for "No Active Rental". <br>**CTAs**: "Choose Your Plan" button anchored to the bottom. |
| **Choose Plan**   | `choose_plan_screen.dart`   | **UI**: Horizontal Scrollable Plan Cards. Each card lists: Plan Name, Duration, Price (Bold), and Included Features (Checkmark list).                              |
| **Plan Success**  | `plan_success_screen.dart`  | **Visual**: Full-screen green gradient background with "Subscription Active" Lottie animation and a "Next: Vehicle Pickup" button.                                 |

### 2.5 Vehicle Pickup Workflow (Precision Ops)

| Screen Name        | File Path                         | Detailed Component Breakdown                                                                                                      |
| :----------------- | :-------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| **Pickup Hub**     | `pickup_hub_screen.dart`          | **UI**: Integrated Google Maps widget showing the Hub location. Tapping the Hub card opens native Navigation (Google/Apple Maps). |
| **Pickup Vehicle** | `pickup_vehicle_screen.dart`      | **UI**: Camera-view QR Scanner with a scanning square overlay. Manual entry field provided as a fallback below the scanner.       |
| **Vehicle Photos** | `vehicle_photos_screen.dart`      | **Layout**: 4-grid photo capture layout. Each slot has a Ghost overlay (e.g., "Front View") to guide the rider.                   |
| **Inspection**     | `pickup_inspection_screen.dart`   | **Components**: Categorized checklist (Battery, Tires, Lights). Toggle buttons for "Good" or "Needs Attention".                   |
| **Verification**   | `pickup_verification_screen.dart` | **UI**: Embedded `MyDocumentsScreen` for agreement viewing + `SignaturePad` widget for digital sign-off.                          |
| **Pickup Success** | `pickup_success_screen.dart`      | **Visual**: Confetti animation + Vehicle ID badge display. Routes directly to `ActiveDashboardScreen`.                            |

### 2.6 Active Dashboard & Mission Control

| Screen Name        | File Path                      | Detailed Component Breakdown                                                                                                                                                                                                                                 |
| :----------------- | :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Active Dash**    | `active_dashboard_screen.dart` | **Background**: `VoltMeshGradient` (Black base with blue/cyan glows). <br>**Stats Section**: 2x2 Grid showing Range (km), Battery (%), Speed (km/h), and Temperature. <br>**Overdue Alert**: Floating warning bar at the top if the subscription is expired. |
| **Rental Details** | `rental_details_screen.dart`   | **UI**: Detailed vehicle specs list + Rental Timeline. Includes a "Renew Plan" button and "Report Issue" link.                                                                                                                                               |
| **End Rental**     | `end_rental_screen.dart`       | **Logic**: GPS Geofencing check (Must be at Hub). <br>**UI**: Final meter reading input and mandatory vehicle condition photo capture.                                                                                                                       |

### 2.7 Financial System (Wallet & Payments)

| Screen Name        | File Path                | Detailed Component Breakdown                                                                                                                 |
| :----------------- | :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wallet Screen**  | `wallet_screen.dart`     | **Header**: Large Balance Card with `primaryGradient`. <br>**Body**: List of recent transactions with "Withdraw" or "Top-up" action buttons. |
| **Top-up Flow**    | `top_up_..._screen.dart` | **Sequence**: Purpose Selection (Grid) -> Amount Selection (Pills for 500, 1000, 2000) -> UPI App selector -> Success Receipt.               |
| **History Screen** | `history_screen.dart`    | **UI**: Tabbed view (All, Credit, Debit). Each entry shows Date, Type, Amount (Colored), and a "View Receipt" button.                        |

### 2.8 Support & Fleet Operations

| Screen Name        | File Path                    | Detailed Component Breakdown                                                                                                             |
| :----------------- | :--------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **Support Center** | `support_center_screen.dart` | **UI**: Icon grid for categories (Payments, Vehicle, App, Legal). Search bar at top for FAQ entries.                                     |
| **FAQ Screen**     | `faq_screen.dart`            | **UI**: Expandable List tiles. Tapping a question smoothly expands the answer with a cross-fade animation.                               |
| **Troubleshooter** | `troubleshooter_screen.dart` | **UI**: Branching decision tree UI. Large "YES" and "NO" buttons. Final state results in a "Solution" card or "Support Ticket" creation. |
| **TL Details**     | `tl_details_screen.dart`     | **UI**: Profile card for the Team Leader. Features a large "CALL TL" floating button in `primary` blue.                                  |

### 2.9 Profile, Settings & Rewards

| Screen Name        | File Path                  | Detailed Component Breakdown                                                                                                           |
| :----------------- | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **Profile Screen** | `profile_screen.dart`      | **Header**: User Avatar + KYC Verification badge. <br>**Menu**: Icon-led list of sub-screens (Rewards, Referral, Settings, Documents). |
| **App Settings**   | `app_settings_screen.dart` | **Toggles**: Dark Mode, Biometric Login, Notification categories. All use standard Material switches with `primary` active color.      |
| **Referral**       | `referral_screen.dart`     | **UI**: Large Referral Code card with one-tap "Copy" button and "Share" action.                                                        |
| **Rewards**        | `rewards_screen.dart`      | **UI**: Gamified progress bars for "Level 1-5" + Grid of unlocked/locked achievement badges.                                           |
| **Feedback**       | `feedback_screen.dart`     | **UI**: 5-Star interactive rating component + Multi-line text field for comments.                                                      |

---

## 3. Interaction & Animation Specs

- **Screen Transitions**: Standardized `CupertinoPageRoute` for iOS and `MaterialPageRoute` for Android to maintain platform-native feel.
- **Micro-interactions**:
  - **Button Tap**: `ScaleTransition` (0.95x scale on press).
  - **Form Error**: `ShakeAnimation` on the input field + color shift to `AppColors.error`.
  - **Success States**: Lottie `confetti.json` triggered on transaction/pickup completion.
- **Empty States**: Centralized `EmptyStateWidget` featuring custom illustrations and a context-aware primary CTA.
