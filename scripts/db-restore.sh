#!/usr/bin/env bash
# =============================================================================
# Voltium — PostgreSQL Restore Script
# =============================================================================
# Restores a PostgreSQL database from a pg_dump file.
#
# Usage:
#   bash scripts/db-restore.sh backups/voltium_2026-06-15_120000.sql
#   bash scripts/db-restore.sh backups/voltium_2026-06-15_120000.sql --env staging
#   bash scripts/db-restore.sh backups/voltium_2026-06-15_120000.sql --force
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
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_FILE="$2"
      shift 2
      ;;
    --force|-f)
      FORCE=true
      shift
      ;;
    --help|-h)
      echo "Usage: bash scripts/db-restore.sh <backup-file> [--env staging|production] [--force]"
      echo ""
      echo "  <backup-file>        Path to the .sql backup file to restore"
      echo "  --env ENV            Use .env.staging or .env.production (default: .env.local)"
      echo "  --force, -f          Skip confirmation prompt (for CI/CD)"
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

if [ "$FORCE" != "true" ]; then
  read -p "Are you sure? Type 'yes' to continue: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 1
  fi
fi

echo ""
echo "Restoring database from backup..."
echo ""

psql "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" 2>/dev/null
psql "$DATABASE_URL" < "$BACKUP_FILE"

echo ""
echo "Restore complete: $BACKUP_FILE"

if command -v npx &>/dev/null && [ -f "$PROJECT_DIR/web/package.json" ]; then
  echo ""
  echo "Running Prisma migrations to bring schema up-to-date..."
  cd "$PROJECT_DIR/web"
  npx prisma migrate deploy
  echo "Migrations applied."
fi
