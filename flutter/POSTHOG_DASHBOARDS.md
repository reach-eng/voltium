# PostHog Dashboard Setup

Import these funnel and trend definitions into PostHog after events start flowing.

---

## Dashboard 1: Onboarding Funnel

**Type:** Funnel  
**Name:** Onboarding Funnel  
**Steps:**

| Step | Event | Filter |
|------|-------|--------|
| 1 | `splash_viewed` | — |
| 2 | `legal_accepted` | — |
| 3 | `phone_entered` | — |
| 4 | `otp_requested` | — |
| 5 | `otp_verified` | — |
| 6 | `signup_completed` | — |

**Breakdown by:** `is_sign_up` (on `phone_entered`)  
**Time window:** 30 days  
**Conversion metric:** Step-over-step conversion rate

---

## Dashboard 2: Revenue Funnels

### 2A. Plan Purchase Funnel

**Type:** Funnel  
**Name:** Plan Purchase  
**Steps:**

| Step | Event | Filter |
|------|-------|--------|
| 1 | `plan_selected` | — |
| 2 | `plan_purchased` | — |

**Breakdown by:** `plan_type` (on `plan_selected`)

### 2B. Top-Up Funnel

**Type:** Funnel  
**Name:** Wallet Top-Up  
**Steps:**

| Step | Event | Filter |
|------|-------|--------|
| 1 | `wallet_top_up_initiated` | — |
| 2 | `wallet_top_up_submitted` | — |
| 3 | `top_up_completed` | — |

**Breakdown by:** `is_deposit` (on `wallet_top_up_submitted`)

---

## Dashboard 3: Engagement Trends

### 3A. Tab Usage

**Type:** Trend  
**Name:** Tab Usage  
**Event:** `tab_switched`  
**Breakdown by:** `tab_name`  
**Chart:** Stacked bar (daily)

### 3B. Support Tickets

**Type:** Trend  
**Name:** Support Tickets by Category  
**Event:** `ticket_created`  
**Breakdown by:** `category`  
**Chart:** Line (weekly)

### 3C. Referral Activity

**Type:** Trend  
**Name:** Referral Shares  
**Event:** `referral_shared`  
**Chart:** Line (daily)

### 3D. Notification Engagement

**Type:** Trend  
**Name:** Notification Opens  
**Event:** `notification_opened`  
**Chart:** Line (daily)

---

## Dashboard 4: Error Monitoring

**Type:** Trend  
**Name:** Error Rate  
**Events:** `fatal_error`, `otp_request_failed`, `otp_verification_failed`  
**Chart:** Line (daily)  
**Alert:** > 10 errors/day

---

## Dashboard 5: Key Metrics

### 5A. Daily Active Users

**Type:** Trend  
**Name:** DAU  
**Event:** `splash_viewed`  
**Math:** Unique users  
**Chart:** Line (daily)

### 5B. New Signups

**Type:** Trend  
**Name:** New Signups  
**Event:** `signup_completed`  
**Math:** Total count  
**Chart:** Line (daily)

### 5C. Revenue Events

**Type:** Trend  
**Name:** Revenue Activity  
**Events:** `plan_purchased`, `top_up_completed`, `deposit_submitted`  
**Chart:** Stacked bar (daily)

---

## PostHog Import (JSON)

Copy-paste into PostHog → Dashboards → New Dashboard → Add Insight → JSON:

```json
{
  "onboarding_funnel": {
    "type": "FunnelViz",
    "name": "Onboarding Funnel",
    "filters": {
      "events": [
        {"id": "splash_viewed", "type": "events", "order": 0},
        {"id": "legal_accepted", "type": "events", "order": 1},
        {"id": "phone_entered", "type": "events", "order": 2},
        {"id": "otp_requested", "type": "events", "order": 3},
        {"id": "otp_verified", "type": "events", "order": 4},
        {"id": "signup_completed", "type": "events", "order": 5}
      ],
      "funnel_window_days": 30
    }
  },
  "plan_funnel": {
    "type": "FunnelViz",
    "name": "Plan Purchase",
    "filters": {
      "events": [
        {"id": "plan_selected", "type": "events", "order": 0},
        {"id": "plan_purchased", "type": "events", "order": 1}
      ],
      "funnel_window_days": 7
    }
  },
  "topup_funnel": {
    "type": "FunnelViz",
    "name": "Wallet Top-Up",
    "filters": {
      "events": [
        {"id": "wallet_top_up_initiated", "type": "events", "order": 0},
        {"id": "wallet_top_up_submitted", "type": "events", "order": 1},
        {"id": "top_up_completed", "type": "events", "order": 2}
      ],
      "funnel_window_days": 7
    }
  }
}
```
