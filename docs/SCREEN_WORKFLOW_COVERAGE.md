# Screen Workflow Coverage

This document is the source of truth for the admin console and rider app screens required to perform Voltium's public-beta workflows.

## Admin console sections

| Workflow area | Required screens/sections | Status |
|---|---|---|
| Dashboard | Dashboard overview, quick actions, backup/server status | Implemented |
| Rider lifecycle | Riders, rider details, lifecycle timeline, documents, wallet, rentals, support, audit history | Implemented through Riders and linked detail flows |
| Verification | KYC Management, Guarantors, document viewer, decision history, field notes | Implemented |
| Rental operations | Rentals, Pickup & Return, Operations Board, Fleet Map, Shifts, Team Leaders | Implemented/wired |
| Fleet | Vehicles, Hubs, Fleet Map, Device Tracking, maintenance/inspection views | Implemented/wired |
| Money | Plans & Pricing, Wallet & Deposits, Payments / Top-ups, Reports | Implemented/wired |
| Engagement | Notifications, Bulk Messaging, Rewards, Referrals, Offers & Coupons | Implemented/wired |
| Support | Support Tickets, FAQ Management, Incidents & Fines, Legal Documents | Implemented/wired |
| Security | Admin Users, Roles & Permissions, Audit Logs, Feature Flags | Implemented/wired |
| Laptop operations | System Settings, Server Health, Data Management, Maintenance Mode | Implemented/wired |
| Coverage map | Workflow Coverage | Implemented |

## Rider app screens

| Workflow area | Required screens | Status |
|---|---|---|
| Auth | Splash, legal consent, permissions, login, OTP, auth choice | Implemented |
| Onboarding | Intent of use, rider profile, signature, documents, guarantor | Implemented and reachable |
| Plan/deposit | Choose plan, plan success, top-up purpose, amount, UPI, proof upload, receipt | Implemented and routed |
| Pickup/rental | Pickup hub, vehicle photos, pickup verification, pickup success, active dashboard, rental details, end rental | Implemented and reachable |
| Wallet | Wallet, transaction history, security deposit, top-up flow | Implemented and reachable |
| Support | Support center, checklist, FAQ, troubleshooter, feedback | Implemented and reachable |
| Engagement | Notifications, smart notifications, preferences, rewards, referrals | Implemented and reachable |
| Profile/safety | Profile, edit profile, app settings, legal, emergency SOS, emergency contacts | Implemented and reachable |
| App coverage hub | Workflow & Services hub | Implemented |

## Public beta rule

Do not add a business workflow without adding both:

1. A screen entry in the appropriate admin console section.
2. A rider app screen or rider app route when the workflow is rider-facing.

