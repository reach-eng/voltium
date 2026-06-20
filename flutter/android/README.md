# Voltium Android Implementation

The active Android project for the rider app lives here under `flutter/android`.

Device-policy and kiosk-adjacent behavior is implemented in:

- `app/src/main/kotlin/com/voltiumelectric/voltium/MainActivity.kt`
- `app/src/main/kotlin/com/voltiumelectric/voltium/VoltiumDeviceAdminReceiver.kt`
- `app/src/main/res/xml/device_admin_policies.xml`

The obsolete repository-root `android/` stub is intentionally not used.
