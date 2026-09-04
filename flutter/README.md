# Voltium Rider App

Voltium rider mobile app for EV rental onboarding, KYC, wallet/deposit, plan selection, pickup, active rental, return, support, notifications, rewards, and profile workflows.

## Getting Started

Use this Flutter project to build the public rider app.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.

## Permissions & Device Data (policy note)

`android/app/src/main/AndroidManifest.xml` declares permissions beyond the
standard INTERNET/CAMERA/LOCATION set. Their intended purposes:

| Permission | Used by | Purpose |
| --- | --- | --- |
| `READ_CONTACTS` | `DeviceDataService.syncContacts` | Optional device-data sync, consent-gated |
| `READ_CALL_LOG` / `READ_PHONE_STATE` | `DeviceDataService.syncCallLogs` | Optional device-data sync, consent-gated |
| `RECORD_AUDIO` | Guarantor video step | Guarantor verification recording |
| `FOREGROUND_SERVICE` / `..._LOCATION`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Rental tracking | Active-rental location + device-compliance kiosk features |

> **⚠️ Play Store gate (FOLLOWUP_TICKETS.md F-APP-1/F-APP-2, 2026-09-04):**
> `READ_CALL_LOG` and contact/call-log upload are Google Play *restricted*
> permissions requiring a declared, reviewed use case before release.
> `DeviceDataService` uploads contacts and call-log entries to the backend
> behind in-app consent flags — this needs explicit Product/Legal sign-off
> (or a feature-flag removal) before any store submission. See
> `docs/FOLLOWUP_TICKETS.md` → "Flutter app audit follow-ups (2026-09-04)".
