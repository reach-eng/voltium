#!/usr/bin/env bash
set -eo pipefail
export PATH="/usr/bin:$PATH"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Ticket #34 hardening: prevent the script from silently passing when
# the migration glob does not expand (e.g. wrong working dir on Windows
# Git Bash, or empty *.sql). Old behavior: 2>/dev/null + non-expanding glob
# → grep returns 0 matches → FAILED=0 → exit 0. Audit found this.
# Fix: use `find` for explicit file enumeration + shopt nullglob + bail
# loudly if no migration files were found but the dir exists.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "=== Prisma Migration Safety Review Check ==="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# P0 fix 2026-09-03: resolve to repo root so the gate works from ANY cwd.
# CI runs it from web/ (working-directory: ./web) as `bash
# ../scripts/check-migration-safety.sh`, where the relative
# `web/prisma/migrations` does not exist and the gate no-op'd with exit 0.
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [ -f "$SCRIPT_DIR/common-env.sh" ]; then
  # shellcheck source=common-env.sh
  source "$SCRIPT_DIR/common-env.sh"
else
  MIGRATION_DIR="web/prisma/migrations"
fi
# Anchor relative dirs at the repo root (absolute values pass through).
case "$MIGRATION_DIR" in
  /*) ;;
  *) MIGRATION_DIR="$REPO_ROOT/$MIGRATION_DIR" ;;
esac

if [ ! -d "$MIGRATION_DIR" ]; then
  echo "[OK] No migration directory found to scan."
  exit 0
fi

# Enumerate .sql files explicitly via find (immune to glob expansion issues).
# P0 fix 2026-09-03: the old glob "$MIGRATION_DIR"/*.sql never matched because
# real files live one level deeper (<name>/migration.sql), so the gate always
# exited 0 without scanning anything (DROP migrations passed silently).
mapfile -t SQL_FILES < <(find "$MIGRATION_DIR" -name 'migration.sql' -type f | sort)

# If find returned nothing, that's a real "no migrations" case
if [ "${#SQL_FILES[@]}" -eq 0 ]; then
  echo "[OK] No migration .sql files found under $MIGRATION_DIR."
  exit 0
fi

# P0 fix 2026-09-03: narrowed to true data-loss DDL. The old 4th pattern
# `ALTER TABLE.*DROP` also matched safe statements (`ALTER COLUMN .. DROP
# DEFAULT`, `DROP CONSTRAINT`) and drowned the signal. DROP CONSTRAINT /
# DROP DEFAULT / DROP INDEX are reviewable, transactional, and non-lossy.
UNSAFE_PATTERNS=("DROP COLUMN" "DROP TABLE" "TRUNCATE")
# Grandfathered history (already applied in every environment — blocking on
# them would fail CI forever while protecting nothing). Any NEW migration
# outside this list that drops a column/table or truncates still fails loudly.
#   - 20260729150000_float_to_paise: paise currency migration (DROP amount)
#   - 20260730131814_convert_json_columns: JSONB migration (DROP payload, …)
#   - 20260712000001_consolidate_settings: settings→system_settings copy-then-drop
GRANDFATHERED=("20260729150000_float_to_paise" "20260730131814_convert_json_columns" "20260712000001_consolidate_settings")
# PR-68b — warn (not error) on ADD COLUMN NOT NULL without DEFAULT.
# A NOT NULL column added without a DEFAULT scans the entire table to
# backfill. For a Transaction table with 1M rows, that's a 30-minute
# write-lock. Use `::warning::` (not `::error::`) since some patterns are
# safe (e.g., adding to a small lookup table or with concurrent backfill).
WARN_PATTERNS=("ALTER TABLE.*ADD COLUMN.*NOT NULL[^,)]*\)")
FAILED=0

for pattern in "${UNSAFE_PATTERNS[@]}"; do
  for file in "${SQL_FILES[@]}"; do
    # Skip grandfathered history (see GRANDFATHERED above).
    skip=0
    for g in "${GRANDFATHERED[@]}"; do
      if [[ "$file" == *"/$g/"* ]]; then skip=1; break; fi
    done
    if [ "$skip" -eq 1 ]; then continue; fi
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

# Warning patterns — printed but don't fail the check.
for pattern in "${WARN_PATTERNS[@]}"; do
  for file in "${SQL_FILES[@]}"; do
    cleaned_sql=$(sed -E 's/--.*$//g' "$file" | tr '\n' '\r' | sed -E 's/\/\*.*?\*\///g' | tr '\r' '\n')
    matches=$(echo "$cleaned_sql" | grep -inE "$pattern" || true)
    if [ -n "$matches" ]; then
      echo "In $file matching '$pattern':"
      echo "$matches"
      echo "::warning:: ADD COLUMN NOT NULL without DEFAULT — large tables will lock for backfill. Consider adding a DEFAULT or using a multi-step migration."
    fi
  done
done

if [ "$FAILED" -ne 0 ]; then
  echo "[FAIL] Migration safety check found destructive patterns."
  exit 1
fi

echo "[OK] Migration safety check complete."
exit 0
