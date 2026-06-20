#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LEGACY_LOWER="volt""fleet"
LEGACY_SPACED="volt"" fleet"
LEGACY_CAMEL="Volt""Fleet"
LEGACY_FILE_PATTERN="*${LEGACY_LOWER}*"
LEGACY_FILE_PATTERN_CAMEL="*${LEGACY_CAMEL}*"

fail() {
  echo "[branding-check] FAIL: $1" >&2
  exit 1
}

if grep -RInE "${LEGACY_LOWER}|${LEGACY_SPACED}|\b[Rr]yd\b" \
  --exclude=check-voltium-branding.sh \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.next \
  --exclude-dir=build \
  --exclude-dir=.dart_tool \
  --exclude-dir=dist \
  . >/tmp/voltium_branding_legacy.txt; then
  cat /tmp/voltium_branding_legacy.txt >&2
  fail "legacy scaffold naming or Ryd branding found"
fi

if find . \( -iname "${LEGACY_FILE_PATTERN}" -o -iname "${LEGACY_FILE_PATTERN_CAMEL}" \) | grep -q .; then
  find . \( -iname "${LEGACY_FILE_PATTERN}" -o -iname "${LEGACY_FILE_PATTERN_CAMEL}" \) >&2
  fail "legacy scaffold filenames found"
fi

if grep -RInE 'com\.example\.voltium|com\.example\.voltium_rider|com\.example\.fallback' flutter \
  --exclude-dir=build \
  --exclude-dir=.dart_tool >/tmp/voltium_branding_example.txt; then
  cat /tmp/voltium_branding_example.txt >&2
  fail "example bundle/application identifiers found"
fi

grep -q 'applicationId = "com.voltiumelectric.voltium"' flutter/android/app/build.gradle.kts || fail "Android applicationId must be com.voltiumelectric.voltium"
grep -q 'namespace = "com.voltiumelectric.voltium"' flutter/android/app/build.gradle.kts || fail "Android namespace must be com.voltiumelectric.voltium"
grep -q '<string>Voltium</string>' flutter/ios/Runner/Info.plist || fail "iOS display/name must be Voltium"
grep -q 'PRODUCT_BUNDLE_IDENTIFIER = com.voltiumelectric.voltium' flutter/macos/Runner/Configs/AppInfo.xcconfig || fail "macOS bundle ID must be com.voltiumelectric.voltium"
grep -q '"name": "Voltium"' flutter/web/manifest.json || fail "Flutter web manifest name must be Voltium"
grep -q '"short_name": "Voltium"' flutter/web/manifest.json || fail "Flutter web manifest short_name must be Voltium"

echo "[branding-check] PASS: Voltium branding is consistent and no legacy scaffold remnants were found."
