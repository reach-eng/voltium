#!/usr/bin/env bash
# =============================================================================
# Voltium — PostgreSQL Backup Script
# =============================================================================
# Creates a timestamped pg_dump of the configured PostgreSQL database.
#
# Usage:
#   bash scripts/db-backup.sh                          # Backup using DATABASE_URL
#   bash scripts/db-backup.sh --output backup_2026.sql  # Custom filename
#   bash scripts/db-backup.sh --env staging             # Use .env.staging
#
# Requirements:
#   - PostgreSQL client tools (pg_dump, psql) installed locally
#   - DATABASE_URL environment variable or .env file
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_DIR/backups"

# Parse arguments
OUTPUT_FILE=""
ENV_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output|-o)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --env)
      ENV_FILE="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: bash scripts/db-backup.sh [--output FILE] [--env staging|production]"
      echo ""
      echo "  --output, -o FILE    Custom output filename (default: voltium_YYYY-MM-DD_HHMMSS.sql)"
      echo "  --env ENV            Use .env.staging or .env.production (default: .env.local)"
      echo "  --help, -h           Show this help"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# Load environment
if [ -n "$ENV_FILE" ]; then
  ENV_PATH="$PROJECT_DIR/.env.$ENV_FILE"
  if [ ! -f "$ENV_PATH" ]; then
    echo "❌ Environment file not found: $ENV_PATH"
    exit 1
  fi
  set -a
  source "$ENV_PATH"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  # Try loading .env.local as fallback
  if [ -f "$PROJECT_DIR/.env.local" ]; then
    set -a
    source "$PROJECT_DIR/.env.local"
    set +a
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL not set. Provide --env or set DATABASE_URL in .env.local"
  exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Generate output filename
if [ -z "$OUTPUT_FILE" ]; then
  TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
  OUTPUT_FILE="voltium_${TIMESTAMP}.sql"
fi

OUTPUT_PATH="$OUTPUT_DIR/$OUTPUT_FILE"

echo "📦 Backing up PostgreSQL database..."
echo "   Output: $OUTPUT_PATH"
echo ""

pg_dump \
  --dbname="$DATABASE_URL" \
  --format=plain \
  --no-owner \
  --no-acl \
  --file="$OUTPUT_PATH"

echo ""
echo "✅ Backup complete: $OUTPUT_PATH"
echo "   Size: $(du -h "$OUTPUT_PATH" | cut -f1)"

# Print connection info (safe — masks password)
SAFE_URL=$(echo "$DATABASE_URL" | sed -E 's|://([^:]+):([^@]+)@|://\1:****@|')
echo "   Database: $SAFE_URL"
