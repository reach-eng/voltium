# Google Play Store Permissions & Sensitive Data Disclosure

This document records Voltium's declarations, justifications, prominent disclosures, and privacy policies for sensitive Android runtime permissions and power management exceptions under Google Play Developer Policies.

---

## 1. Executive Summary & Policy Compliance

| Permission | Purpose | User Disclosure / Consent | Policy Justification |
|------------|---------|---------------------------|----------------------|
| `android.permission.READ_CONTACTS` | Emergency contact selection for vehicle recovery, accident safety notification, and referral invites. | Prominent in-app disclosure dialog in onboarding + ConsentService toggle. | User convenience when picking emergency guarantor or safety contacts; contacts are never sold or used for ad targeting. |
| `android.permission.READ_CALL_LOG` | Telematics fraud detection, active rental dispute verification, and accident emergency response verification. | Explicit in-app consent tile (`ConsentType.callLogs`) before requesting runtime access. | High-value physical EV rental asset protection and rental dispute resolution. |
| `android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Continuous BLE heartbeat & GPS telemetry during active rental sessions, vehicle anti-theft geofencing, and accident detection. | Prominent in-app battery optimization explanation tile in Onboarding Permissions screen. | IoT-connected companion app exception (keeps Bluetooth telemetry and emergency SOS active when screen is off). |
| `android.permission.CALL_PHONE` | **REMOVED** | N/A | Previously declared; audited and removed. All telephony calls are initiated via `Intent.ACTION_DIAL` (`tel:`) launching the user's native dialer. |

---

## 2. Telephony Policy & Removal of `CALL_PHONE`

### Finding
Previous iterations declared `android.permission.CALL_PHONE` in `AndroidManifest.xml`. However, inspection of the Flutter codebase revealed that all user-facing call triggers (Support Hotline, SOS Emergency Number, Team Leader phone) use `url_launcher` with `tel:` URIs.

### Resolution
- `tel:` URIs trigger `android.intent.action.DIAL` (defined in `<queries>` in `AndroidManifest.xml`), which presents the dialer interface to the rider and requires no telephony permissions.
- `android.permission.CALL_PHONE` has been completely removed from `AndroidManifest.xml`, eliminating the risk of Google Play Store rejection under the default dialer policy.

---

## 3. Prominent In-App Disclosures & User Consent Flow

Google Play's User Data policy requires that apps collecting sensitive user data (contacts, call logs) provide prominent disclosure and obtain user consent **prior** to runtime permission requests.

### Contacts (`READ_CONTACTS`)
- **Screen**: `flutter/lib/features/onboarding/presentation/screens/permissions_screen.dart`
- **Disclosure Copy**:
  > *"Voltium accesses your contacts solely to allow you to easily select emergency contacts and guarantors for your vehicle rental, and for safety notifications in case of roadside emergencies. We do not sell or share your contact list with third parties."*
- **Consent Tracking**: Recorded through `ConsentService.setConsent(ConsentType.contacts, granted: true/false)` and synchronized to the backend via `DeviceDataService.syncPermissionState()`.

### Call Logs (`READ_CALL_LOG`)
- **Disclosure Copy**:
  > *"Voltium requests call log access to verify emergency communications during active rides and prevent unauthorized vehicle handoffs. This data is encrypted in transit and at rest."*
- **Consent Tracking**: Recorded through `ConsentService.setConsent(ConsentType.callLogs, granted: true/false)`. Data collection only executes when `hasConsent(ConsentType.callLogs)` evaluates to `true`.

---

## 4. Battery Optimization (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`)

### Policy Exception Category
Google Play Developer Policy restricts `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` except for specific acceptable use cases. Voltium qualifies under:
- **Connected Device Companion App / Fleet Telematics**:
  - Voltium electric scooters communicate with the rider's phone via Bluetooth Low Energy (BLE) and cellular telemetry during active rides.
  - Background power throttling pauses BLE keep-alive beacons, triggering accidental vehicle motor cut-offs or loss of real-time crash detection.
  - The rider is shown an explanatory card detailing that battery optimization exemption prevents the scooter from losing connection while riding.

---

## 5. Security & Data Retention

- Data collected via `DeviceDataService` is encrypted in transit using TLS 1.3.
- Data retained on PostgreSQL follows the data retention schedule outlined in `docs/PRIVACY_DATA_RETENTION.md`.
- Riders may revoke consent or request data deletion at any time via Settings → Privacy & Data Management.
