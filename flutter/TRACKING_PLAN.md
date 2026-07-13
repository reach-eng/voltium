# Voltium Rider App — Tracking Plan

Single source of truth for all analytics events. Every event is tracked via **PostHog**.

**Setup:** `flutter run --dart-define-from-file=.env` (reads `POSTHOG_API_KEY` from `flutter/.env`)

---

## Conversions

| Conversion | Event | Counting | Decision It Supports |
|------------|-------|----------|---------------------|
| Rider signed up | `signup_completed` | Once per user | Acquisition cost, channel ROI |
| Plan purchased | `plan_purchased` | Every occurrence | Revenue, plan popularity |
| Top-up completed | `top_up_completed` | Every occurrence | Wallet engagement, revenue |
| Deposit submitted | `deposit_submitted` | Every occurrence | Onboarding completion rate |
| Vehicle picked up | `pickup_completed` | Once per lease | Fulfillment rate |

---

## Onboarding Funnel

| # | Event | Properties | Trigger | Decision |
|---|-------|------------|---------|----------|
| 1 | `splash_viewed` | — | App launch, splash screen init | App open rate |
| 2 | `legal_accepted` | — | User accepts terms and taps continue | Legal friction |
| 3 | `phone_entered` | `is_sign_up` | User submits phone (after validation) | Auth funnel entry |
| 4 | `otp_requested` | `has_referral`, `is_sign_up` | OTP API call succeeds | OTP delivery rate |
| 5 | `otp_verified` | `is_new_rider` | OTP verification succeeds | Auth conversion |
| 6 | `signup_completed` | `referral_code` (optional) | New rider completes first login | **Conversion** |
| 7 | `onboarding_completed` | — | User completes onboarding flow | Onboarding drop-off |

---

## Revenue Events

| Event | Properties | Trigger | Decision |
|-------|------------|---------|----------|
| `plan_selected` | `plan_type`, `price` | User taps a plan card | Plan interest |
| `plan_purchased` | — | Plan success screen displayed | **Conversion** |
| `wallet_top_up_initiated` | `amount` | User proceeds from amount screen | Top-up intent |
| `wallet_top_up_submitted` | `amount`, `has_proof_image`, `is_deposit` | Proof uploaded successfully | Top-up funnel |
| `top_up_completed` | `amount`, `purpose` | Receipt screen displayed | **Conversion** |
| `deposit_submitted` | `amount` | Amount matches security deposit | **Conversion** |
| `rental_ended` | `duration`, `plan_type` | Rental end confirmed | Retention, churn |

---

## Engagement Events

| Event | Properties | Trigger | Decision |
|-------|------------|---------|----------|
| `tab_switched` | `tab_index`, `tab_name` | Bottom nav tap | Feature usage |
| `notification_opened` | — | Notification screen init | Engagement |
| `ticket_created` | `category` | Support ticket submitted | Support load |
| `referral_shared` | `method` | Referral code copied/shared | Viral growth |
| `emergency_sos_triggered` | — | SOS button tapped | Safety incidents |

---

## KYC & Compliance

| Event | Properties | Trigger | Decision |
|-------|------------|---------|----------|
| `kyc_submitted` | `document_count` | KYC form submitted | KYC funnel |
| `guarantor_form_submitted` | — | Guarantor form submitted | Guarantor funnel |

---

## Identity & Session

| Event | Properties | Trigger | Decision |
|-------|------------|---------|----------|
| `identify()` | `lifecycle_status`, `account_status` | After OTP verification | User segmentation |
| `reset()` | — | Logout | Session boundary |

---

## Errors

| Event | Properties | Trigger | Decision |
|-------|------------|---------|----------|
| `fatal_error` | `error_type`, `error_message`, `reason` | FlutterError / ZoneError handler | Stability |
| `otp_request_failed` | `error_message` | OTP API call fails | Auth reliability |
| `otp_verification_failed` | `error_message` | OTP verify API call fails | Auth reliability |

---

## Screen Tracking

Automatic via `PosthogObserver()` navigator observer in `main.dart`. Every route change captures a screen view.

---

## Properties Reference

| Property | Type | Used In | PII? |
|----------|------|---------|------|
| `is_sign_up` | `String` ("true"/"false") | `phone_entered`, `otp_requested` | No |
| `has_referral` | `String` ("true"/"false") | `otp_requested` | No |
| `referral_code` | `String` | `signup_completed` | No |
| `is_new_rider` | `String` ("true"/"false") | `otp_verified` | No |
| `lifecycle_status` | `String` | `identify()` | No |
| `account_status` | `String` | `identify()` | No |
| `tab_index` | `String` ("0"-"3") | `tab_switched` | No |
| `tab_name` | `String` | `tab_switched` | No |
| `category` | `String` | `ticket_created` | No |
| `method` | `String` | `referral_shared` | No |
| `amount` | `String` (paise) | Revenue events | No |
| `purpose` | `String` | `top_up_completed` | No |
| `plan_type` | `String` | `plan_selected`, `rental_ended` | No |
| `price` | `String` | `plan_selected` | No |
| `duration` | `String` | `rental_ended` | No |
| `has_proof_image` | `String` | `wallet_top_up_submitted` | No |
| `is_deposit` | `String` | `wallet_top_up_submitted` | No |
| `document_count` | `String` | `kyc_submitted` | No |

---

## PII Scrubbing

All events pass through `PostHogService._scrubProperties()` which scrubs:
- `phone`, `email`, `otp`, `aadhaar`, `pan`, `password` → `[SCRUBBED]`

---

## Implementation

| Layer | File | Role |
|-------|------|------|
| `PostHogService` | `lib/core/observability/posthog_service.dart` | Primary backend — all events go through here |
| `AnalyticsService` | `lib/services/analytics_service.dart` | Convenience wrapper — delegates to PostHog |
| `MonitoringService` | `lib/services/monitoring_service.dart` | Local debug breadcrumbs (`debugPrint` only) |
| `PosthogObserver` | `main.dart` | Automatic screen tracking |

---

## Activation

```bash
# Android device
flutter run -d <device_id> --dart-define=POSTHOG_API_KEY=phc_xxx --dart-define=POSTHOG_HOST=https://us.i.posthog.com

# Or from .env file
flutter run --dart-define-from-file=.env

# Web build
bash scripts/build-web-with-env.sh
```

---

## PostHog Dashboards

### Onboarding Funnel
```
Funnel: splash_viewed → legal_accepted → phone_entered → otp_requested → otp_verified → signup_completed
```

### Revenue Funnel
```
Funnel: plan_selected → plan_purchased
Funnel: wallet_top_up_initiated → wallet_top_up_submitted → top_up_completed
```

### Engagement
```
Trend: tab_switched (by tab_name)
Trend: notification_opened
Trend: ticket_created (by category)
Trend: referral_shared
```

### Error Rate
```
Trend: fatal_error, otp_request_failed, otp_verification_failed
```
