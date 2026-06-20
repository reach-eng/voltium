#!/usr/bin/env bash
# =============================================================================
# Voltium — Cloud Data Enforcement Check
# =============================================================================
# Note: Firebase Auth & FCM are explicitly allowed for user authentication
# and notification services. Other cloud services (GCS, S3, Neon, etc.)
# are forbidden to ensure data remains local.
# =============================================================================
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FOUND=0
PATTERN='@upstash/redis|@google-cloud/storage|@aws-sdk/client-s3|@aws-sdk/s3-request-presigner|@sentry/nextjs|sentry_flutter|UPSTASH_REDIS|SENTRY_DSN|GCS_BUCKET|S3_BUCKET|R2_BUCKET|Neon|Supabase|Railway|Google Cloud Storage|Cloudflare R2'
HITS=$(cd "$ROOT" && grep -RInE "$PATTERN" . \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=build --exclude-dir=.dart_tool --exclude-dir=dist --exclude-dir=web/dist \
  --exclude-dir=.kilo --exclude-dir=.opencode --exclude-dir=docs --exclude-dir=.saropa --exclude-dir=.idea --exclude-dir=ephemeral --exclude-dir=.codex-review --exclude="check-no-cloud-data.sh" --exclude="*package-lock.json" --exclude="*tsconfig.tsbuildinfo" \
  2>/dev/null || true)
if [ -n "$HITS" ]; then
  echo "FAIL: cloud app-data/error-tracking references found:"
  echo "$HITS"
  FOUND=1
else
  echo "PASS: no forbidden cloud data/error-tracking references found"
fi
exit $FOUND
