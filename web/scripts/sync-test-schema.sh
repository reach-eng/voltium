#!/usr/bin/env bash
#
# Sync the test schema with the Prisma schema.
#
# Strategy (robust for fresh CI containers AND pre-existing local test
# schemas — no migration history required):
#   1. `prisma db push` against the ?schema=test DB. This works on any
#      schema state (empty, already-synced, or previously created by
#      `prisma db push`), is idempotent, and absorbs schema.prisma drift.
#      Note: we deliberately do NOT use `prisma migrate deploy` here —
#      the test schema is created by db push (no _prisma_migrations
#      history), which makes migrate deploy refuse to run with P3005,
#      and the 0_init baseline + later migrations have a duplicate-index
#      conflict (Transaction_createdAt_idx) that breaks fresh deploys.
#   2. Apply the datetime → timestamptz conversion idempotently (the
#      same intent as the datetime_to_timestamptz migration). Prisma's
#      default `db push` creates `timestamp(3)` columns; converting them
#      to `timestamptz` fixes timezone-naive time comparisons. The
#      conversion must run AFTER db push because `prisma db push`
#      reverts timestamptz back to `timestamp(3)` on every run — this
#      step is what makes the conversion stick. CI sets SKIP_PRISMA_PUSH
#      so vitest's global-setup does not push again and undo it.
#
# Usage:
#   bash scripts/sync-test-schema.sh
#
# Environment:
#   DATABASE_URL — connection string to the test database. If unset,
#                  it is loaded from web/.env (local development).
#
# Run this once per CI build (or locally when the schema changes)
# instead of running `prisma db push` on every `npm test` invocation.
# CI wiring lives in .github/workflows/ci-cd.yml (Tests job), and
# web/tests/global-setup.ts verifies the synced schema by checking a
# sentinel column ('purgedAt' on "riders") — if that check fails, run
# this script.

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  # Local development: load DATABASE_URL from web/.env.
  DATABASE_URL="$(node -e "require('dotenv').config(); process.stdout.write(process.env.DATABASE_URL || '')" 2>/dev/null || true)"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set (and could not be loaded from .env)" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

# Append ?schema=test to the URL for the sync.
TEST_URL="${DATABASE_URL}"
if [[ "$TEST_URL" != *"schema="* ]]; then
  if [[ "$TEST_URL" == *"?"* ]]; then
    TEST_URL="${TEST_URL}&schema=test"
  else
    TEST_URL="${TEST_URL}?schema=test"
  fi
fi
export TEST_URL

# Refuse to touch the public schema — this script is for the disposable
# test schema only.
SCHEMA_NAME="$(node -e "
const url = new URL(process.env.TEST_URL);
process.stdout.write(url.searchParams.get('schema') || '');
" )"
if [ -z "${SCHEMA_NAME}" ] || [ "${SCHEMA_NAME}" = "public" ]; then
  echo "ERROR: sync-test-schema.sh must run against a non-public schema (got '${SCHEMA_NAME:-<none>}')" >&2
  exit 1
fi

echo "==> Syncing test schema '${SCHEMA_NAME}'..."

echo "==> Pushing Prisma schema to test schema..."
DATABASE_URL="$TEST_URL" npx prisma db push --accept-data-loss --skip-generate

echo "==> Applying datetime -> timestamptz conversion (idempotent)..."
# Raw pg connections do NOT inherit the ?schema= URL parameter (search_path
# stays 'public'), so every statement here is fully schema-qualified.
DATABASE_URL="$TEST_URL" node -e "
const { Client } = require('pg');
const url = new URL(process.env.TEST_URL);
const schema = url.searchParams.get('schema');
const q = (s) => '\"' + String(s).replace(/\"/g, '\"\"') + '\"';
const c = new Client({ connectionString: process.env.TEST_URL });
c.connect()
  .then(() => c.query(
    'SELECT table_name, column_name FROM information_schema.columns ' +
    'WHERE table_schema = \$1 AND data_type = \$2',
    [schema, 'timestamp without time zone'],
  ))
  .then(async (res) => {
    const cols = res.rows;
    if (cols.length === 0) {
      console.log('  no naive timestamp columns to convert');
      return;
    }
    for (const col of cols) {
      await c.query(
        'ALTER TABLE ' + q(schema) + '.' + q(col.table_name) +
        ' ALTER COLUMN ' + q(col.column_name) + ' TYPE timestamptz',
      );
    }
    console.log('  converted ' + cols.length + ' column(s) to timestamptz');
  })
  .then(() => c.end())
  .catch((e) => { console.error(e.message); process.exit(1); });
"

echo "==> Test schema '${SCHEMA_NAME}' synced."
