# Voltium App Functionality & Workflows

This document details the core functions, technical architecture, and business workflows of the Voltium Electric Vehicle Rental Platform.

## 1. System Architecture

Voltium is built as a distributed system with three primary layers:

1.  **Rider App (Flutter)**: A cross-platform mobile application for Android and iOS using `Provider` for state management.
2.  **Admin Dashboard (Next.js)**: A responsive web-based command center for fleet operations.
3.  **Backend Services (Next.js API)**: A RESTful API layer with PostgreSQL storage and Redis-based utilities.

---

## 2. Core Business Workflows

### 2.1 Rider Onboarding & Identity

**Path**: Auth -> Form -> KYC -> Guarantor

1.  **OTP Authentication**:
    - User enters a 10-digit phone number.
    - System generates and sends a 6-digit OTP (Mocked in dev: `111111`).
    - JWT session is established upon successful verification.
2.  **Basic Profile**:
    - Collection of Name, Email, and Intent (e.g., Delivery, Personal).
3.  **Guarantor Onboarding**:
    - Requirement for a third-party guarantor to verify the rider's identity.
    - Collection of Guarantor Name, Phone, Address, Relationship, and a verified Photo.
4.  **KYC Verification**:
    - Upload of Aadhaar (Front/Back) and PAN card.
    - Status transitions: `Pending` -> `Approved` or `Rejected`.
    - **Technical Note**: Once verified, core identity fields are locked to prevent unauthorized changes.

### 2.2 Wallet & Payment Flow

**Path**: Dashboard -> Wallet -> Top-up -> Receipt

1.  **Balance Display**: Real-time balance in Paise (converted to Rupees in UI).
2.  **Top-up Flow (3-Step)**:
    - **Step 1 (Purpose)**: User selects payment intent (e.g., Security Deposit, Weekly Rent).
    - **Step 2 (Amount)**: User enters the amount or selects from presets.
    - **Step 3 (UPI)**: User is presented with a unique UPI ID and QR code for external payment.
3.  **Security Deposit**:
    - Logic distinguishes between "Refundable" and "Non-Refundable" deposits based on the `depositRefundThreshold`.
4.  **Proof Submission**:
    - User uploads a screenshot of the payment receipt.
    - Admin reviews and approves the transaction via the Admin Panel.

### 2.3 Vehicle Rental & Pickup

**Path**: Plans -> Hub -> Vehicle -> Inspection -> Success

1.  **Plan Selection**: User chooses a rental subscription (e.g., Weekly, Monthly).
2.  **Hub Selection**: User selects a physical pickup hub.
3.  **Vehicle Assignment**:
    - QR code scanning for physical vehicle verification.
4.  **Inspection Workflow**:
    - Mandatory 4-photo capture (Front, Back, Left, Right).
    - Capture of Odometer reading.
5.  **Activation**: Setting the `pickupDone` flag to `true` transitions the user to the Active Dashboard.

### 2.4 Earnings & Performance Tracking

**Path**: Dashboard -> Earnings Log

1.  **Multi-Platform Support**: Riders can log earnings from Zomato, Swiggy, Zepto, Blinkit, etc.
2.  **Weekly Analytics**: Visual representation of daily earnings using a custom charting engine.
3.  **Metrics**: Real-time tracking of Total Earnings, Total Trips, and Online Hours.
4.  **Persistence**: Data is persisted locally via `SharedPreferences` for offline access.

### 2.5 Rewards & Loyalty

**Path**: Profile -> VoltRewards

1.  **Tier System**: Bronze, Silver, and Gold tiers based on point accumulation.
2.  **Payment Streak**: Visual 5-day streak tracker encouraging on-time rent payments.
3.  **Redemption**: Unlocked rewards (e.g., free recharge, wallet credit) can be claimed once streak targets are met.
4.  **Audit Trail**: Detailed history of all point credits (Login bonuses, referrals, etc.).

---

## 3. Dashboard State Transitions

The system manages two distinct dashboard states to guide riders from registration to active vehicle operation.

### 3.1 Pre-Active Dashboard (The Checklist)

Used when `pickupDone` is `false`. It acts as a gateway, requiring:

- **KYC Approval**: Verified by Admin.
- **Deposit Fulfillment**: Minimum wallet balance reached.
- **Plan Selection**: Active subscription chosen.
- **Technical Component**: `PreDashboardScreen` utilizing `AccountActionCard` for each requirement.

### 3.2 Active Dashboard (The Command Center)

Used when `pickupDone` is `true`. It provides:

- **Live Vehicle Stats**: Battery percentage, Odometer, and Subscription countdown.
- **Support & SOS**: Floating SOS button and Fleet Team Leader (TL) contact details.
- **Quick Actions**: "Extend Plan", "Report Incident", and "End Rental".
- **Technical Component**: `ActiveDashboardScreen` utilizing `DashboardStatCard` and `TeamLeaderCard`.

---

## 4. Visual & Technical Standards

### 4.1 Design Aesthetics

- **Visual System**: Utilizes a premium design language with HSL-tailored colors (e.g., Indigo/Blue for primary actions, Emerald for success).
- **Glassmorphism**: Extensive use of blurred, semi-transparent backgrounds for cards and overlays.
- **Animations**: `FadeUpWidget` provides smooth entrance transitions for all screen elements.

### 4.2 Technical Instrumentation

- **Testability**: Every interactive element (Buttons, Inputs, Cards) is assigned a `ValueKey` or `Key` for deterministic E2E testing.
- **Navigation**: Centralized `AppNavigator` for standardized slide and fade transitions.
- **Error Handling**: Standardized `ErrorModal` and `OfflineBanner` for robust session recovery.

---

## 5. Auxiliary Workflows

### 5.1 Smart Troubleshooter

- Interactive decision tree (`troubleshooter_screen.dart`) for self-service vehicle issue resolution.

### 5.2 Support Tickets

- Image-based ticket creation for billing or technical issues, managed via the Admin Panel.

---

_Last Updated: 2026-05-15_
