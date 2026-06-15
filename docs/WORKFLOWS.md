# Voltium Workflow Inventory

> Comprehensive list of every business workflow in the Voltium platform. Each workflow documents the trigger, steps, actors, status transitions, and affected systems.

---

## Workflow Map

### Rider Lifecycle (Top-Level)

```
NEW → PHONE_VERIFIED → PROFILE_SUBMITTED → KYC_SUBMITTED → KYC_APPROVED
→ GUARANTOR_SUBMITTED → GUARANTOR_APPROVED → DEPOSIT_PENDING
→ DEPOSIT_APPROVED → PLAN_SELECTED → PICKUP_SCHEDULED → ACTIVE
```

### Active Rider States

```
ACTIVE → SUSPENDED → ACTIVE (after reinstatement)
ACTIVE → RETURN_PENDING → CLOSED
```

---

## 1. Rider Registration

**Trigger**: User opens app for first time after OTP login

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Flutter | User submits name, email, intent | → PHONE_VERIFIED |
| 2 | API | Store profile data | `rider` row created |
| 3 | API | Set lifecycle state | `state: PROFILE_SUBMITTED` |

**Actors**: Rider
**API Routes**: `POST /api/rider/profile`, `PUT /api/rider/profile`
**Flutter Screens**: `user_onboarding_screen.dart`, `intent_of_use_screen.dart`

---

## 2. OTP Login

**Trigger**: User enters phone number and requests OTP

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Flutter | User enters 10-digit phone | — |
| 2 | API | Send OTP via SMS provider | — |
| 3 | Flutter | User enters 6-digit OTP | — |
| 4 | API | Verify OTP, issue JWT | — |
| 5 | API | Set session cookie | — |

**Actors**: Rider
**API Routes**: `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`
**Flutter Screens**: `login_screen.dart`, `otp_verification_screen.dart`
**Rate Limit**: 5 attempts per phone per 15 minutes

---

## 3. Profile Onboarding

**Trigger**: First login after phone verification

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Flutter | Collect name, email, father/mother name, DOB, address | — |
| 2 | Flutter | Upload profile photo | — |
| 3 | API | Validate and store profile | → PROFILE_SUBMITTED |
| 4 | API | Mark registration done | `registrationDone: true` |

**Actors**: Rider
**API Routes**: `PUT /api/rider/profile`
**Flutter Screens**: `user_onboarding_screen.dart`

---

## 4. KYC Submission

**Trigger**: Rider submits identity documents

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Flutter | Upload Aadhaar front/back | — |
| 2 | Flutter | Upload PAN card | — |
| 3 | Flutter | Upload signature | — |
| 4 | Flutter | Enter Aadhaar number, PAN number | — |
| 5 | Flutter | Enter bank details (name, account, IFSC) | — |
| 6 | API | Validate and store KYC profile | → KYC_SUBMITTED |
| 7 | API | Set KYC status | `kycStatus: SUBMITTED` |

**Actors**: Rider
**API Routes**: `POST /api/rider/kyc`
**Flutter Screens**: `user_onboarding_screen.dart`

---

## 5. KYC Approval/Rejection

**Trigger**: Admin reviews rider KYC submission

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Admin UI | View KYC documents | — |
| 2 | Admin UI | Approve or reject with reason | — |
| 3 | API | Update KYC status | → KYC_APPROVED / KYC_REJECTED |
| 4 | API | Update rider lifecycle | `state: KYC_APPROVED` or revert |
| 5 | API | Send notification to rider | — |
| 6 | Audit | Log admin action | — |

**Actors**: Admin (KYC_REVIEWER role)
**API Routes**: `POST /api/admin/kyc` (approve/reject)
**Admin Screens**: KYC review panel
**Notifications**: Push to rider on approval/rejection

---

## 6. Guarantor Submission

**Trigger**: Rider submits guarantor details

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Flutter | Enter guarantor name, relation, phone, address | — |
| 2 | Flutter | Upload guarantor Aadhaar, PAN, photo | — |
| 3 | Flutter | Verify guarantor phone via OTP | — |
| 4 | API | Validate and store guarantor profile | → GUARANTOR_SUBMITTED |
| 5 | API | Set guarantor status | `guarantor.status: SUBMITTED` |

**Actors**: Rider
**API Routes**: `POST /api/rider/guarantor`
**Flutter Screens**: `guarantor_onboarding_screen.dart`

---

## 7. Guarantor Approval/Rejection

**Trigger**: Admin reviews guarantor submission

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Admin UI | View guarantor documents | — |
| 2 | Admin UI | Approve or reject with reason | — |
| 3 | API | Update guarantor status | → GUARANTOR_APPROVED / REJECTED |
| 4 | API | Update rider lifecycle | `state: GUARANTOR_APPROVED` |
| 5 | Audit | Log admin action | — |

**Actors**: Admin (KYC_REVIEWER role)
**API Routes**: `POST /api/admin/guarantors` (approve/reject)

---

## 8. Deposit Upload / Top-Up

**Trigger**: Rider submits wallet top-up or security deposit payment

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Flutter | Select purpose (wallet top-up / security deposit) | — |
| 2 | Flutter | Enter amount or select preset | — |
| 3 | Flutter | Copy UPI ID, complete payment externally | — |
| 4 | Flutter | Upload payment screenshot/proof | — |
| 5 | API | Create transaction as PENDING | `transaction.status: PENDING` |
| 6 | API | If deposit, create DepositRecord | `deposit.status: PENDING` |

**Actors**: Rider
**API Routes**: `POST /api/rider/wallet` (top-up)
**Flutter Screens**: `wallet_screen.dart`, top-up flow screens
**Critical**: Must use idempotency key to prevent double submission

---

## 9. Deposit Approval/Rejection

**Trigger**: Admin reviews deposit/transaction proof

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Admin UI | View payment proof | — |
| 2 | Admin UI | Approve or reject with reason | — |
| 3 | API | Update transaction status | → APPROVED / REJECTED |
| 4 | Wallet | Create ledger entry (CREDIT) | — |
| 5 | Wallet | Update wallet balance | `wallet.balanceInPaise += amount` |
| 6 | Audit | Log admin action | — |
| 7 | API | Send notification to rider | — |

**Actors**: Admin (FINANCE_ADMIN role)
**API Routes**: `POST /api/admin/transactions` (approve/reject)
**Critical**: Must be idempotent — double-approve should not double-credit

---

## 10. Rent Due / Overdue

**Trigger**: Scheduled job checks active rentals

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Worker | Scan active rentals approaching due date | — |
| 2 | Worker | Send rent reminder notification | — |
| 3 | Worker | If overdue, mark rental as OVERDUE | `rental.status: OVERDUE` |
| 4 | Worker | Attempt wallet auto-debit | — |
| 5 | Worker | If debit fails, send alert | — |

**Actors**: System (background worker)
**Schedule**: Daily cron
**Affects**: RentalLease, Wallet, Notifications

---

## 11. Wallet Debit (Rent Payment)

**Trigger**: System auto-debited or manual rent payment

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Wallet Service | Check wallet balance | — |
| 2 | Wallet | Create ledger entry (DEBIT) | — |
| 3 | Wallet | Decrease wallet balance | `wallet.balanceInPaise -= amount` |
| 4 | Transaction | Create DEBIT transaction | `transaction.status: APPROVED` |
| 5 | Notification | Send payment receipt | — |

**Actors**: System / Rider
**Affects**: Wallet, WalletLedger, Transaction, RentalLease

---

## 12. Rewards / Referrals

**Trigger**: Rider shares referral code or achieves milestone

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Flutter | Copy/share referral code | — |
| 2 | API | New rider signs up with referral code | — |
| 3 | Worker | Credit reward points to referrer | — |
| 4 | Wallet | Create reward ledger entry (CREDIT) | — |
| 5 | Notification | Send reward earned alert | — |

**Actors**: Rider (referrer), System (worker)
**API Routes**: Referral code validation during registration
**Flutter Screens**: `referral_screen.dart`, `rewards_screen.dart`

---

## 13. Traffic Fine

**Trigger**: Fine challan associated with a rider

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Admin/System | Create fine record | `fine.status: PENDING` |
| 2 | API | Notify rider about fine | — |
| 3 | Rider | Pay fine or dispute | → PAID / DISPUTED |
| 4 | Admin | Review dispute | → RESOLVED / WAIVED |

**Actors**: Admin, Rider
**Affects**: TrafficFine, Wallet (if deduction)

---

## 14. Support Ticket

**Trigger**: Rider submits a support request

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Flutter | Select category, enter subject/message | — |
| 2 | Flutter | Optionally attach images | — |
| 3 | API | Create support ticket | `ticket.status: OPEN` |
| 4 | Admin UI | View and assign ticket | → ASSIGNED |
| 5 | Admin UI | Respond or resolve | → RESOLVED / CLOSED |
| 6 | API | Notify rider on response | — |

**Actors**: Rider, Admin (SUPPORT_AGENT role)
**API Routes**: `POST /api/support/tickets`, `POST /api/admin/support/*`
**Flutter Screens**: `support_center_screen.dart`

---

## 15. Notification

**Trigger**: System event that requires rider notification

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | API/Worker | Create notification record | `notification.isRead: false` |
| 2 | API | Send push via FCM | — |
| 3 | Flutter | Display in notification center | — |
| 4 | Flutter | Mark as read when tapped | `isRead: true` |

**Actors**: System, Admin
**API Routes**: Notifications created by various events
**Flutter Screens**: `notification_center_screen.dart`

---

## 16. Vehicle Booking (Plan Selection)

**Trigger**: KYC-approved rider selects a rental plan

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Flutter | Browse available plans | — |
| 2 | Flutter | Select plan (daily/weekly/monthly) | — |
| 3 | API | Subscribe rider to plan | `rider.currentPlan: set` |
| 4 | API | Create rental lease | `lease.status: BOOKED` |
| 5 | API | Update rider lifecycle | → PLAN_SELECTED |

**Actors**: Rider
**API Routes**: Rental booking routes
**Flutter Screens**: `choose_plan_screen.dart`, `plan_success_screen.dart`

---

## 17. Vehicle Pickup

**Trigger**: Rider arrives at hub to pick up assigned vehicle

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Flutter | Select hub | — |
| 2 | Flutter | Select vehicle from available list | — |
| 3 | Flutter | Enter and verify emergency contact OTP | — |
| 4 | Flutter | Capture 4 photos (front, back, left, right) | — |
| 5 | Flutter | Capture selfie with vehicle | — |
| 6 | API | Submit pickup verification | — |
| 7 | API | Assign vehicle to rider | `rider.assignedVehicle: set` |
| 8 | API | Update vehicle status | → ASSIGNED |
| 9 | API | Update rider lifecycle | → ACTIVE |
| 10 | Audit | Log pickup completion | — |

**Actors**: Rider, Hub Manager (admin verification)
**API Routes**: `POST /api/rider/sync/pickup`
**Flutter Screens**: `pickup_hub_screen.dart`, pickup flow screens

---

## 18. Active Rental

**Trigger**: Rider has picked up vehicle and rental is active

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Flutter | Display dashboard with vehicle stats | — |
| 2 | API | Track battery level, location (polling) | — |
| 3 | System | Monitor rent due dates | — |
| 4 | Flutter | Show subscription countdown | — |
| 5 | System | Auto-debit rent on due date | — |

**Actors**: Rider, System
**Affects**: Dashboard display, rental lifecycle
**Flutter Screens**: `active_dashboard_screen.dart`

---

## 19. Vehicle Return

**Trigger**: Rider initiates vehicle return

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Flutter | Initiate return from dashboard | — |
| 2 | Flutter | Capture 4 return photos (left, right, front, speedometer) | — |
| 3 | Flutter | Submit return request | — |
| 4 | API | Create return request | `return.status: PENDING` |
| 5 | API | Update rider state | → RETURN_PENDING |
| 6 | Admin UI | Review return photos | — |
| 7 | Admin | Approve or reject return | → RETURN_APPROVED / reject |
| 8 | API | If approved: close rental, release vehicle | → CLOSED |
| 9 | API | Process security deposit refund | `deposit.status: REFUNDED` |

**Actors**: Rider, Admin (HUB_MANAGER role)
**API Routes**: Return submission + admin review routes
**Flutter Screens**: End rental flow

---

## 20. Admin Actions (General)

| Action | Actor | Entity | Notes |
|--------|-------|--------|-------|
| Create rider | Admin | Rider | Manual rider creation |
| Update rider | Admin | Rider | State changes, notes |
| Lock rider account | Admin | Rider | Security lock |
| View ledger | Admin | Wallet | Read-only |
| Run reconciliation | Admin | Wallet | Daily job |
| Manage vehicles | Admin | Vehicle | CRUD |
| Manage hubs | Admin | Hub | CRUD |
| Manage plans | Admin | RentalPlan | CRUD |
| Send announcements | Admin | Notification | Bulk push/SMS |
| View reports | Admin | Various | Analytics |

**API Routes**: `POST /api/admin/*`

---

## 21. Background Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| Rent Due Checker | Daily | Detect and notify overdue rentals |
| Auto-Debit | Daily | Attempt wallet debit for due rent |
| Wallet Reconciliation | Daily | Compare ledger sum vs wallet balance |
| Notification Cleanup | Weekly | Purge old read notifications |
| Device Compliance | Hourly | Check rider device permissions |
| Referral Reward | On-demand | Process referral rewards |
| Telemetry Cleanup | Monthly | Purge old location/call log data |

---

## 22. File Upload Workflow

**Trigger**: Rider or admin uploads a document/image

| Step | Component | Action |
|------|-----------|--------|
| 1 | Flutter | Select file from camera/gallery |
| 2 | Flutter | Compress image (max 1024x1024, quality 80) |
| 3 | Flutter | Upload to API endpoint |
| 4 | API | Store file (local/GCS) |
| 5 | API | Return file URL |
| 6 | Flutter | Display confirmation |

**File Types**: KYC documents, profile photos, vehicle photos, payment proofs, support attachments
**Current Storage**: Local filesystem / GCS
**Security Concern**: Public KYC URLs — must move to signed URLs

---

## 23. Device Compliance

**Trigger**: Rider app checks device permissions

| Step | Component | Action | Status Change |
|------|-----------|--------|---------------|
| 1 | Flutter | Check location, battery, camera permissions | — |
| 2 | Flutter | Report violations to API | — |
| 3 | API | Log device violation | `violation.status: ACTIVE` |
| 4 | Admin UI | View and resolve violations | → RESOLVED |

**Actors**: System (Flutter), Admin
**Flutter Screens**: Device compliance monitoring
**Affects**: DeviceViolation model, rider scoring
