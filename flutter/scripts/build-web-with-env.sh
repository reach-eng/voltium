#!/bin/bash
# Build the Flutter web app with Firebase env vars from .env
# (BLOCKER 1.3). Reads flutter/.env, converts KEY=VALUE into
# --dart-define=KEY=VALUE flags, then invokes flutter build web.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: flutter/.env not found."
  echo "       Copy .env.example to .env and fill in the Firebase keys."
  echo "       See flutter/FIREBASE_SETUP.md for instructions."
  exit 1
fi

# Required Firebase keys (BLOCKER 1.3). All 9 must be set.
REQUIRED_KEYS=(
  FIREBASE_API_KEY_ANDROID
  FIREBASE_APP_ID_ANDROID
  FIREBASE_MESSAGING_SENDER_ID_ANDROID
  FIREBASE_API_KEY_IOS
  FIREBASE_APP_ID_IOS
  FIREBASE_MESSAGING_SENDER_ID_IOS
  FIREBASE_IOS_BUNDLE_ID
  FIREBASE_PROJECT_ID
  FIREBASE_STORAGE_BUCKET
)

declare -a DEFINE_FLAGS=()
MISSING=()

# Load .env and check for empty values
for key in "${REQUIRED_KEYS[@]}"; do
  value=$(grep -E "^${key}=" .env | cut -d '=' -f 2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" || true)
  if [ -z "$value" ]; then
    MISSING+=("$key")
  else
    DEFINE_FLAGS+=("--dart-define=${key}=${value}")
  fi
done

# Optional: pass PostHog analytics keys if present
for key in POSTHOG_API_KEY POSTHOG_HOST; do
  value=$(grep -E "^${key}=" .env | cut -d '=' -f 2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" || true)
  if [ -n "$value" ]; then
    DEFINE_FLAGS+=("--dart-define=${key}=${value}")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: The following Firebase keys are missing or empty in flutter/.env:"
  for key in "${MISSING[@]}"; do
    echo "  - $key"
  done
  echo "See flutter/FIREBASE_SETUP.md for where to find these."
  exit 1
fi

echo "==> Building Flutter web with ${#DEFINE_FLAGS[@]} --dart-define flags"
flutter build web --release --base-href "/rider-app/" "${DEFINE_FLAGS[@]}"
