#!/usr/bin/env bash
#
# Sync the test schema with the Prisma schema and apply the
# datetime_to_timestamptz migration. Run this once per CI build (or
# locally when the schema changes) instead of running prisma db push on
# every `npm test` invocation.
#
# Usage:
#   bash scripts/sync-test-schema.sh
#
# Environment:
#   DATABASE_URL — connection string to the test database

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

# Append ?schema=test to the URL for the push
TEST_URL="${DATABASE_URL}"
if [[ "$TEST_URL" != *"schema="* ]]; then
  if [[ "$TEST_URL" == *"?"* ]]; then
    TEST_URL="${TEST_URL}&schema=test"
  else
    TEST_URL="${TEST_URL}?schema=test"
  fi
fi

echo "==> Pushing Prisma schema to test schema..."
DATABASE_URL="$TEST_URL" npx prisma db push --accept-data-loss --skip-generate

echo "==> Applying datetime_to_timestamptz migration to test schema..."
# The migration iterates over both 'public' and 'test' schemas, so it
# will cover the test schema too.
DATABASE_URL="$TEST_URL" npx prisma migrate deploy

echo "==> Test schema synced."
