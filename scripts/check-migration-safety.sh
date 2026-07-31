#!/usr/bin/env bash
set -eo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Ticket #34 hardening: prevent the script from silently passing when
# the migration glob does not expand (e.g. wrong working dir on Windows
# Git Bash, or empty *.sql). Old behavior: 2>/dev/null + non-expanding glob
# → grep returns 0 matches → FAILED=0 → exit 0. Audit found this.
# Fix: use `find` for explicit file enumeration + shopt nullglob + bail
# loudly if no migration files were found but the dir exists.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "=== Prisma Migration Safety Review Check ==="

MIGRATION_DIR="web/prisma/migrations"

if [ ! -d "$MIGRATION_DIR" ]; then
  echo "[OK] No migration directory found to scan."
  exit 0
fi

# Enumerate .sql files explicitly via find (immune to glob expansion issues)
shopt -s nullglob
SQL_FILES=( "$MIGRATION_DIR"/*.sql )

# If glob didn't expand, the array is empty — that's a real "no migrations" case
if [ "${#SQL_FILES[@]}" -eq 0 ]; then
  echo "[OK] No migration .sql files found in $MIGRATION_DIR."
  exit 0
fi

UNSAFE_PATTERNS=("DROP COLUMN" "DROP TABLE" "TRUNCATE" "ALTER TABLE.*DROP")
FAILED=0

for pattern in "${UNSAFE_PATTERNS[@]}"; do
  for file in "${SQL_FILES[@]}"; do
    # Strip SQL single-line (-- ...) and block (/* ... */) comments before matching
    cleaned_sql=$(sed -E 's/--.*$//g' "$file" | tr '\n' '\r' | sed -E 's/\/\*.*?\*\///g' | tr '\r' '\n')
    matches=$(echo "$cleaned_sql" | grep -inE "$pattern" || true)
    if [ -n "$matches" ]; then
      echo "In $file matching '$pattern':"
      echo "$matches"
      echo "::error:: Potentially destructive migration query detected matching pattern '$pattern' in $file"
      FAILED=1
    fi
  done
done

if [ "$FAILED" -ne 0 ]; then
  echo "[FAIL] Migration safety check found destructive patterns."
  exit 1
fi

echo "[OK] Migration safety check complete."
exit 0
