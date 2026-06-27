# Firebase Setup

The app uses Firebase for:
- **Firebase Auth** — Optional Google-signed ID token verification (falls back to OTP)
- **Firebase Cloud Messaging (FCM)** — Push notifications

## Prerequisites

```bash
npm install -g firebase-tools
dart pub global activate flutterfire_cli
```

## Configure

```bash
# Login to Firebase (opens browser)
firebase login

# Create a Firebase project at https://console.firebase.google.com
# Enable Authentication (Phone) and Cloud Messaging

# Run FlutterFire configure — regenerates firebase_options.dart and downloads configs
flutterfire configure --project=voltium-rider

# This will overwrite:
#   - lib/firebase_options.dart
#   - android/app/google-services.json
#   - ios/Runner/GoogleService-Info.plist (if iOS configured)
```

## Development

For local development without real Firebase credentials, the app:
- Falls back to OTP-based login when Firebase Auth is unavailable
- Logs a warning and skips FCM initialization
- Works fully with `--dart-define=API_URL=http://localhost:8081`

## Production / CI Integration

The repository commits **dummy** `firebase_options.dart` and `google-services.json` files to prevent secret leakage. 
For production releases, the CI pipeline must inject the real configuration:

1. Base64-encode the real `google-services.json` and store it as a GitHub Secret (`GOOGLE_SERVICES_JSON_BASE64`).
2. Base64-encode the real `firebase_options.dart` and store it as a GitHub Secret (`FIREBASE_OPTIONS_DART_BASE64`).
3. During the CI build step (before `flutter build apk`), decode these secrets and overwrite the dummy files:
   ```bash
   echo $GOOGLE_SERVICES_JSON_BASE64 | base64 --decode > android/app/google-services.json
   echo $FIREBASE_OPTIONS_DART_BASE64 | base64 --decode > lib/firebase_options.dart
   ```
4. Verify FCM HMAC secrets are synced with the backend.
