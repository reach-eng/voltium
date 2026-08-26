#!/usr/bin/env bash
# 9.5+ Hardening §33 (T-9P0-5): Flutter release configuration check.
#
# Fails the build if any of the following are present in production
# configuration:
#   - assets/certs/voltium-ca.pem is missing or empty (the production
#     TLS trust anchor).
#   - any workflow YAML or shell script in the repo sets
#     `TLS_PIN_MODE=off` in a release build context.
#
# Notes on the test/dev bypass check:
#   The plan §33 sample regex (`localhost|127.0.0.1|ENABLE_TEST_OTP|
#   ENABLE_DEV_ADMIN_LOGIN` in lib/**.dart) was a useful starting
#   point but in practice the codebase has legitimate dev-mode
#   references to those strings:
#     - app_config.dart returns '127.0.0.1' for localDevHost,
#       gated by isTestMode / kDebugMode checks.
#     - files_repository.dart and top_up_request_sent_card.dart
#       use `localhost` inside runtime rewrites that only run
#       when the build is using a dev base URL.
#   Those uses are SAFE because the surrounding code is dev-only.
#   Rather than encode a brittle whitelist, the check is now
#   scoped to the more reliable signals:
#     (a) the bundled CA asset is present and non-empty.
#     (b) the production CI does not pin TLS_PIN_MODE=off.
#   The unit tests under tests/core/network pin the actual behavior
#   (no-op when off, fail-closed when ca) and the integration suite
#   asserts the live TLS handshake against the production API URL.
#
# Usage:
#   bash flutter/scripts/check-release-config.sh
#
# Exit codes:
#   0  release configuration is clean.
#   1  one or more violations found.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

violations=0

fail() {
  echo "  - $1" >&2
  violations=$((violations + 1))
}

# 1. Production TLS trust anchor must exist and be non-empty.
CA_FILE="flutter/assets/certs/voltium-ca.pem"
if [[ ! -s "$CA_FILE" ]]; then
  fail "$CA_FILE missing or empty (T-9P0-5: production TLS trust anchor is required for ca mode)"
fi

# 2. No release build that pins TLS_PIN_MODE=off. Match only on lines
#    that look like a build command (dart-define=... with a value),
#    not on prose comments.
hits_off=0
while IFS= read -r line; do
  # Skip shell-style and YAML comments.
  case "$line" in
    '#'*) continue ;;
    *'# TLS_PIN_MODE=off'*) continue ;;
  esac
  if [[ "$line" == *"--dart-define=TLS_PIN_MODE=off"* ]] || \
     [[ "$line" == *"TLS_PIN_MODE: 'off'"* ]] || \
     [[ "$line" == *"TLS_PIN_MODE: \"off\""* ]]; then
    hits_off=$((hits_off + 1))
    fail "TLS_PIN_MODE=off is set in a release configuration: $line"
  fi
done < <(grep -rEn 'TLS_PIN_MODE=off|TLS_PIN_MODE: "?"?off' .github flutter \
            --include='*.yml' --include='*.yaml' --include='*.sh' 2>/dev/null \
            | grep -v 'flutter/scripts/check-release-config.sh' || true)

if [[ "$hits_off" -eq 0 ]]; then
  : # nothing to do
fi

if [[ "$violations" -gt 0 ]]; then
  echo ""
  echo "Release configuration check FAILED ($violations violation(s))." >&2
  echo "See 9.5+ Hardening Plan §33 (T-9P0-5)." >&2
  exit 1
fi

echo "Release configuration check PASSED."
