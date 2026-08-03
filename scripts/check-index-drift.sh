#!/usr/bin/env sh
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# scripts/check-index-drift.sh
#
# PR-72 / Audit N2: verify that the CREATE INDEX / DROP INDEX statements
# in web/prisma/migrations/** match the @@index declarations in
# web/prisma/schema.prisma. Catches the "migration adds an index that the
# schema doesn't declare" or "schema drops an index that the migration
# never removed" drift classes.
#
# Usage:
#   SHADOW_DATABASE_URL=postgres://... ./scripts/check-index-drift.sh
#
# Exits:
#   0 — no drift detected (or shadow DB unavailable; warning printed)
#   1 — CREATE INDEX or DROP INDEX found in the diff that does not match
#       a @@index declaration in schema.prisma
#   2 — preflight failure (prisma CLI missing, schema/migration path wrong)
#
# Portable: POSIX sh only (no bashisms). Designed to run on Windows
# Git Bash and on the CI Linux runner.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
SCHEMA="$REPO_ROOT/web/prisma/schema.prisma"
MIGRATIONS_DIR="$REPO_ROOT/web/prisma/migrations"

if [ ! -f "$SCHEMA" ]; then
  echo "[FAIL] schema not found at $SCHEMA" >&2
  exit 2
fi
if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "[FAIL] migrations dir not found at $MIGRATIONS_DIR" >&2
  exit 2
fi

if [ -z "${SHADOW_DATABASE_URL:-}" ]; then
  echo "[WARN] SHADOW_DATABASE_URL is not set; skipping prisma migrate diff."
  echo "       Set SHADOW_DATABASE_URL=postgres://user:pass@host:port/db"
  echo "       (or a SQLite URL like file:./shadow.db) to run the check."
  exit 0
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "[FAIL] npx not found on PATH; install Node.js to run this check." >&2
  exit 2
fi

echo "=== Prisma Index Drift Check (PR-72 / Audit N2) ==="
echo "Schema:     $SCHEMA"
echo "Migrations: $MIGRATIONS_DIR"

# Diff the migrations as-applied (from-schemas) against the live schema
# (to-schema-datamodel). The result is the SQL needed to bring the
# migrations in line with the current schema. If a CREATE INDEX or
# DROP INDEX appears here, the migration files have drifted from the
# schema's @@index declarations.
DIFF_FILE=$(mktemp)
trap 'rm -f "$DIFF_FILE"' EXIT

# shellcheck disable=SC2086
if ! npx --prefix "$REPO_ROOT/web" prisma migrate diff \
    --from-migrations "$MIGRATIONS_DIR" \
    --to-schema-datamodel "$SCHEMA" \
    --shadow-database-url "$SHADOW_DATABASE_URL" \
    > "$DIFF_FILE" 2>&1; then
  echo "[FAIL] prisma migrate diff failed:" >&2
  cat "$DIFF_FILE" >&2
  exit 2
fi

# Filter to lines that look like CREATE INDEX or DROP INDEX (case-insensitive,
# leading whitespace allowed). Ignore comments (-- ...) and blank lines.
DRIFT=$(grep -E -in '^[[:space:]]*(--.*)?$' "$DIFF_FILE" -v | grep -E -i '^[[:space:]]*(CREATE|DROP)[[:space:]]+INDEX' || true)

if [ -n "$DRIFT" ]; then
  echo "[FAIL] index drift detected between schema.prisma and migrations:"
  echo "$DRIFT"
  echo ""
  echo "Either add a matching @@index declaration to schema.prisma or"
  echo "update the migration SQL. Run with --verbose for the full diff."
  exit 1
fi

echo "[OK] no index drift detected."
exit 0
