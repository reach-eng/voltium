#!/usr/bin/env bash
# =============================================================================
# Voltium — PostgreSQL Backup Script
# =============================================================================
# Creates a timestamped pg_dump of the configured PostgreSQL database.
# By default, the backup is encrypted with AES-256-CBC + PBKDF2 (100k iterations)
# using BACKUP_ENCRYPTION_KEY. (We use CBC instead of GCM for broad compatibility
# with all OpenSSL builds including the one bundled in Git for Windows.)
#
# Usage:
#   bash scripts/db-backup.sh                          # Backup using DATABASE_URL
#   bash scripts/db-backup.sh --output backup_2026.sql  # Custom filename
#   bash scripts/db-backup.sh --env staging             # Use .env.staging
#   bash scripts/db-backup.sh --dir /var/backups/voltium
#   bash scripts/db-backup.sh --no-encrypt              # Skip encryption (requires --i-understand-the-pii-risk)
#   bash scripts/db-backup.sh --test-encrypt            # Round-trip test for encryption
#
# Requirements:
#   - PostgreSQL client tools (pg_dump, psql) installed locally
#   - DATABASE_URL environment variable or .env file
#   - openssl (for encryption)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Output directory precedence:
#   1. --dir flag (explicit override)
#   2. $VOLTIUM_BACKUP_DIR env var
#   3. ~/.voltium/backups (laptop default; outside the project tree)
#   4. /var/backups/voltium (server default; outside the project tree)
DEFAULT_BACKUP_DIR="$HOME/.voltium/backups"
if [ "$(uname -s)" = "Linux" ] && [ -d "/var/backups" ] && [ -w "/var/backups" ]; then
  DEFAULT_BACKUP_DIR="/var/backups/voltium"
fi
OUTPUT_DIR="${VOLTIUM_BACKUP_DIR:-$DEFAULT_BACKUP_DIR}"

# Parse arguments
OUTPUT_FILE=""
ENV_FILE=""
NO_ENCRYPT=false
I_UNDERSTAND=false
TEST_ENCRYPT=false

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
    --dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --no-encrypt)
      NO_ENCRYPT=true
      shift
      ;;
    --i-understand-the-pii-risk)
      I_UNDERSTAND=true
      shift
      ;;
    --test-encrypt)
      TEST_ENCRYPT=true
      shift
      ;;
    --help|-h)
      echo "Usage: bash scripts/db-backup.sh [--output FILE] [--env staging|production] [--dir DIR]"
      echo ""
      echo "  --output, -o FILE              Custom output filename (default: voltium_YYYY-MM-DD_HHMMSS.sql.enc)"
      echo "  --env ENV                      Use .env.staging or .env.production (default: .env.local)"
      echo "  --dir DIR                      Override output directory"
      echo "  --no-encrypt                   Skip encryption (requires --i-understand-the-pii-risk)"
      echo "  --i-understand-the-pii-risk    Bypass encryption safety check"
      echo "  --test-encrypt                 Round-trip test for encryption"
      echo "  --help, -h                     Show this help"
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

# Load encryption key from env file if available
if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ] && [ -f "$PROJECT_DIR/.env.local" ]; then
  BACKUP_ENCRYPTION_KEY=$(grep -E '^BACKUP_ENCRYPTION_KEY=' "$PROJECT_DIR/.env.local" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
fi

# ── Test encrypt mode ──────────────────────────────────────────────────────
if [ "$TEST_ENCRYPT" = true ]; then
  echo "=== Encryption Round-Trip Test ==="
  TEST_KEY="test-key-$(date +%s)"
  TEST_PAYLOAD="Voltium backup encryption test payload — $(date -Iseconds)"
  TEST_DIR=$(mktemp -d)

  echo "$TEST_PAYLOAD" | openssl enc -aes-256-cbc -pbkdf2 -salt -iter 100000 -pass "pass:$TEST_KEY" -out "$TEST_DIR/test.enc"
  DECRYPTED=$(openssl enc -d -aes-256-cbc -pbkdf2 -salt -iter 100000 -pass "pass:$TEST_KEY" -in "$TEST_DIR/test.enc")

  rm -rf "$TEST_DIR"

  if [ "$DECRYPTED" = "$TEST_PAYLOAD" ]; then
    echo "[OK] Encryption round-trip test passed."
    exit 0
  else
    echo "[FAIL] Encryption round-trip test FAILED."
    exit 1
  fi
fi

# ── Encryption check ───────────────────────────────────────────────────────
ENCRYPT=true
if [ "$NO_ENCRYPT" = true ]; then
  if [ "$I_UNDERSTAND" != true ]; then
    echo "❌ --no-encrypt requires --i-understand-the-pii-risk flag."
    echo "   Unencrypted backups contain full PII (names, phones, addresses, payment metadata)."
    exit 1
  fi
  echo "⚠️  WARNING: Backup will be UNENCRYPTED. PII is exposed."
  ENCRYPT=false
fi

if [ "$ENCRYPT" = true ] && [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "❌ BACKUP_ENCRYPTION_KEY not set. Cannot encrypt backup."
  echo "   Set BACKUP_ENCRYPTION_KEY in .env.local or use --no-encrypt --i-understand-the-pii-risk"
  exit 1
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
  if [ "$ENCRYPT" = true ]; then
    OUTPUT_FILE="voltium_${TIMESTAMP}.sql.enc"
  else
    OUTPUT_FILE="voltium_${TIMESTAMP}.sql"
  fi
fi

OUTPUT_PATH="$OUTPUT_DIR/$OUTPUT_FILE"

echo "📦 Backing up PostgreSQL database..."
echo "   Output: $OUTPUT_PATH"
echo "   Encrypted: $ENCRYPT"
echo ""

# Dump + optional encrypt
TEMP_DUMP=$(mktemp)

pg_dump \
  --dbname="$DATABASE_URL" \
  --format=plain \
  --no-owner \
  --no-acl \
  --file="$TEMP_DUMP"

if [ "$ENCRYPT" = true ]; then
  openssl enc -aes-256-cbc -pbkdf2 -salt -iter 100000 \
    -pass "env:BACKUP_ENCRYPTION_KEY" \
    -in "$TEMP_DUMP" \
    -out "$OUTPUT_PATH"
  rm -f "$TEMP_DUMP"
  echo ""
  echo "✅ Backup ENCRYPTED at: $OUTPUT_PATH"
  echo "   To restore: bash scripts/db-restore.sh $OUTPUT_PATH"
else
  mv "$TEMP_DUMP" "$OUTPUT_PATH"
  echo ""
  echo "✅ Backup complete (UNENCRYPTED): $OUTPUT_PATH"
fi

echo "   Size: $(du -h "$OUTPUT_PATH" | cut -f1)"

# Print connection info (safe — masks password)
SAFE_URL=$(echo "$DATABASE_URL" | sed -E 's|://([^:]+):([^@]+)@|://\1:****@|')
echo "   Database: $SAFE_URL"

# Retention policy pruning: retain last RETENTION_DAYS (default: 14)
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
echo ""
echo "🧹 Pruning backups older than $RETENTION_DAYS days in $OUTPUT_DIR..."
PRUNED_COUNT=0
if [ -d "$OUTPUT_DIR" ]; then
  while IFS= read -r old_file; do
    if [ -n "$old_file" ]; then
      rm -f "$old_file"
      PRUNED_COUNT=$((PRUNED_COUNT + 1))
    fi
  done < <(find "$OUTPUT_DIR" -maxdepth 1 \( -name "voltium_*.sql" -o -name "voltium_*.sql.enc" \) -mtime +"$RETENTION_DAYS" -type f 2>/dev/null || true)
fi
echo "   Pruned $PRUNED_COUNT old backup file(s)."

# Point-In-Time Recovery (PITR) WAL Archive Location
WAL_ARCHIVE_DIR="${VOLTIUM_WAL_ARCHIVE_DIR:-$OUTPUT_DIR/wal_archive}"
mkdir -p "$WAL_ARCHIVE_DIR"
echo "   PITR WAL archive directory ready: $WAL_ARCHIVE_DIR"
echo "   To enable continuous WAL archiving in postgresql.conf:"
echo "     wal_level = replica"
echo "     archive_mode = on"
echo "     archive_command = 'cp \"%p\" \"$WAL_ARCHIVE_DIR/%f\"'  # On Linux/macOS"
echo "     archive_command = 'copy \"%p\" \"$WAL_ARCHIVE_DIR\\%f\"' # On Windows"
