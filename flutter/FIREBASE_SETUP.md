# Firebase Setup

The app uses Firebase for:
- **Firebase Auth** — Optional Google-signed ID token verification (falls back to OTP)
- **Firebase Cloud Messaging (FCM)** — Push notifications

## Configuration via env (BLOCKER 1.3)

The app reads Firebase credentials from build-time `--dart-define` flags.
The values are read by `flutter/lib/core/firebase/firebase_config.dart`.

### 1. Get Firebase credentials

```bash
npm install -g firebase-tools
dart pub global activate flutterfire_cli
firebase login
# Create or open the Firebase project at https://console.firebase.google.com
```

In Firebase Console:
- Project Settings -> Your apps -> Android: copy `apiKey`, `mobilesdk_app_id`, `project_number`
- Project Settings -> Your apps -> iOS: copy the iOS equivalents
- Project Settings -> General: copy `projectId` and `storageBucket`

### 2. Populate `flutter/.env` (copy from `flutter/.env.example`)

```bash
cp flutter/.env.example flutter/.env
# Then edit flutter/.env and fill in the 9 values
```

`.env` is in `.gitignore` and must never be committed.

### 3. Build with env

Use the helper script:

```bash
./flutter/scripts/build-web-with-env.sh
```

It reads `flutter/.env` and passes each value as `--dart-define=KEY=VALUE`
to `flutter build web --release --base-href "/rider-app/"`.

Or manually:

```bash
flutter build web --release --base-href "/rider-app/" \
  --dart-define=FIREBASE_API_KEY_ANDROID=... \
  --dart-define=FIREBASE_APP_ID_ANDROID=... \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID_ANDROID=... \
  --dart-define=FIREBASE_API_KEY_IOS=... \
  --dart-define=FIREBASE_APP_ID_IOS=... \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID_IOS=... \
  --dart-define=FIREBASE_IOS_BUNDLE_ID=com.voltiumelectric.voltium \
  --dart-define=FIREBASE_PROJECT_ID=... \
  --dart-define=FIREBASE_STORAGE_BUCKET=...
```

For Android (APK), the same `--dart-define` flags apply to
`flutter build apk --release`.

### 4. If a value is missing

`Firebase.initializeApp` throws `MissingFirebaseConfigException` at startup
naming the missing key. Fix by adding the value to `.env` and rebuilding.

## Development without real Firebase

`flutter/.env.example` ships with empty values. If you build without
populating `.env`, FCM is unavailable but the app still works for
OTP-based login. Set `TEST_MODE=true` for the e2e tests.

## CI Integration

The CI must:
1. Read 9 secrets from the secret store.
2. Write them to a temporary `.env`.
3. Invoke `./flutter/scripts/build-web-with-env.sh`.

The legacy `GOOGLE_SERVICES_JSON_BASE64` / `FIREBASE_OPTIONS_DART_BASE64`
secrets from previous CI are deprecated. Migrate to the per-key env
variables.

## Legacy

The previous CI flow used base64-encoded `google-services.json` and
`firebase_options.dart`. That path is preserved for reference but
**deprecated** — the env-driven path above is the supported approach.
