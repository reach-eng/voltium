#!/usr/bin/env bash
# =============================================================================
# Voltium — PostgreSQL Restore Script
# =============================================================================
# Restores a PostgreSQL database from a pg_dump file.
#
# Usage:
#   bash scripts/db-restore.sh backups/voltium_2026-06-15_120000.sql
#   bash scripts/db-restore.sh backups/voltium_2026-06-15_120000.sql --env staging
#
# Requirements:
#   - PostgreSQL client tools (psql) installed locally
#   - DATABASE_URL environment variable or .env file
#   - Backup file created by scripts/db-backup.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BACKUP_FILE=""
ENV_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_FILE="$2"
      shift 2
      ;;
    --force|-f)
      echo "Error: --force is no longer supported. Use the Admin UI restore API for automation."
      exit 1
      ;;
    --help|-h)
      echo "Usage: bash scripts/db-restore.sh <backup-file> [--env staging|production]"
      echo ""
      echo "  <backup-file>        Path to the .sql backup file to restore"
      echo "  --env ENV            Use .env.staging or .env.production (default: .env.local)"
      echo "  --help, -h           Show this help"
      exit 0
      ;;
    *)
      if [ -z "$BACKUP_FILE" ]; then
        BACKUP_FILE="$1"
        shift
      else
        echo "Unknown argument: $1"
        exit 1
      fi
      ;;
  esac
done

if [ -z "$BACKUP_FILE" ]; then
  echo "No backup file specified."
  echo "Usage: bash scripts/db-restore.sh <backup-file> [--env ENV]"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Detect encrypted backup and decrypt to a temp file
DECRYPTED_FILE=""
if [[ "$BACKUP_FILE" == *.sql.enc ]]; then
  echo "Detected encrypted backup (.sql.enc). Decrypting..."
  if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    # Try loading from .env.local
    if [ -f "$PROJECT_DIR/.env.local" ]; then
      BACKUP_ENCRYPTION_KEY=$(grep -E '^BACKUP_ENCRYPTION_KEY=' "$PROJECT_DIR/.env.local" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
    fi
  fi
  if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "❌ BACKUP_ENCRYPTION_KEY not set. Cannot decrypt backup."
    exit 1
  fi
  DECRYPTED_FILE="${TMPDIR:-/tmp}/voltium-decrypt-$(date +%Y%m%d-%H%M%S).sql"
  openssl enc -d -aes-256-cbc -pbkdf2 -salt -iter 100000 \
    -pass "env:BACKUP_ENCRYPTION_KEY" \
    -in "$BACKUP_FILE" \
    -out "$DECRYPTED_FILE"
  BACKUP_FILE="$DECRYPTED_FILE"
  echo "Decrypted to temporary file."
fi

if [ -n "$ENV_FILE" ]; then
  ENV_PATH="$PROJECT_DIR/.env.$ENV_FILE"
  if [ ! -f "$ENV_PATH" ]; then
    echo "Environment file not found: $ENV_PATH"
    exit 1
  fi
  set -a
  source "$ENV_PATH"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f "$PROJECT_DIR/.env.local" ]; then
    set -a
    source "$PROJECT_DIR/.env.local"
    set +a
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not set. Provide --env or set DATABASE_URL in .env.local"
  exit 1
fi

echo "WARNING: This will OVERWRITE the target database!"
echo ""
echo "   File:    $BACKUP_FILE"
echo "   Size:    $(du -h "$BACKUP_FILE" | cut -f1)"
SAFE_URL=$(echo "$DATABASE_URL" | sed -E 's|://([^:]+):([^@]+)@|://\1:****@|')
echo "   Target:  $SAFE_URL"
echo ""

PRE_BACKUP="${TMPDIR:-/tmp}/voltium-pre-restore-$(date +%Y%m%d-%H%M%S).sql"
echo "Creating pre-restore backup at $PRE_BACKUP..."
pg_dump "$DATABASE_URL" > "$PRE_BACKUP"
echo "Pre-restore backup size: $(wc -c < "$PRE_BACKUP") bytes"

disable_maintenance_mode() {
  if [ -n "${APP_URL:-}" ] && [ -n "${ADMIN_TOKEN:-}" ]; then
    curl -fsS -X POST "$APP_URL/api/admin/maintenance-mode" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"enabled":false}' >/dev/null || true
  fi
}

if [ -n "${APP_URL:-}" ] && [ -n "${ADMIN_TOKEN:-}" ]; then
  echo "Enabling maintenance mode..."
  curl -fsS -X POST "$APP_URL/api/admin/maintenance-mode" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"enabled":true,"reason":"Database restore in progress"}' >/dev/null
  trap disable_maintenance_mode EXIT
  echo "Waiting 30s for in-flight requests to drain..."
  sleep 30
else
  echo "APP_URL or ADMIN_TOKEN not set; skipping maintenance-mode API coordination."
fi

read -p "Are you sure? Type 'yes' to DROP SCHEMA public CASCADE and restore: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 1
fi

echo ""
echo "Restoring database from backup..."
echo ""

psql "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" 2>/dev/null
psql "$DATABASE_URL" < "$BACKUP_FILE"

echo ""
echo "Restore complete: $BACKUP_FILE"
echo "Pre-restore backup saved at: $PRE_BACKUP"

disable_maintenance_mode
trap - EXIT

if command -v npx &>/dev/null && [ -f "$PROJECT_DIR/web/package.json" ]; then
  echo ""
  echo "Running Prisma migrations to bring schema up-to-date..."
  cd "$PROJECT_DIR/web"
  npx prisma migrate deploy
  echo "Migrations applied."
fi

# Cleanup decrypted temp file
if [ -n "$DECRYPTED_FILE" ] && [ -f "$DECRYPTED_FILE" ]; then
  rm -f "$DECRYPTED_FILE"
  echo "Cleaned up decrypted temporary file."
fi
