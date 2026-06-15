#!/bin/bash
# =============================================================================
# Voltium Database Migration Helper
# =============================================================================
# Usage:
#   bash scripts/migrate.sh backup     — Backup current SQLite database
#   bash scripts/migrate.sh restore    — Restore SQLite database from backup
#   bash scripts/migrate.sh to-pg      — Migrate SQLite data to PostgreSQL
#   bash scripts/migrate.sh status     — Check migration status
#   bash scripts/migrate.sh postgres   — Generate PostgreSQL migration SQL
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DB_DIR="$PROJECT_DIR/db"
SQLITE_DB="$DB_DIR/custom.db"
BACKUP_DIR="$DB_DIR/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$BACKUP_DIR"

case "${1:-help}" in
  backup)
    echo "📦 Backing up SQLite database..."
    if [ -f "$SQLITE_DB" ]; then
      cp "$SQLITE_DB" "$BACKUP_DIR/custom_$TIMESTAMP.db"
      echo "✅ Backup created: $BACKUP_DIR/custom_$TIMESTAMP.db ($(du -h "$BACKUP_DIR/custom_$TIMESTAMP.db" | cut -f1))"
    else
      echo "⚠️  No SQLite database found at $SQLITE_DB"
    fi
    ;;

  restore)
    LATEST=$(ls -t "$BACKUP_DIR"/*.db 2>/dev/null | head -1)
    if [ -z "$LATEST" ]; then
      echo "❌ No backups found in $BACKUP_DIR"
      exit 1
    fi
    echo "📦 Restoring from $LATEST..."
    cp "$LATEST" "$SQLITE_DB"
    echo "✅ Restored to $SQLITE_DB"
    ;;

  to-pg)
    echo "Migrating to PostgreSQL..."
    echo ""
    echo "This migration requires:"
    echo "  1. A managed PostgreSQL database (Neon / Supabase / Railway)"
    echo "  2. prisma schema set to postgresql provider"
    echo ""
    echo "Steps:"
    echo "  1. Sign up for Neon (https://neon.tech) or Supabase (https://supabase.com)"
    echo "  2. Create a new PostgreSQL project and copy the connection string"
    echo "  3. Update prisma/schema.prisma: provider = \"postgresql\""
    echo "  4. Set DATABASE_URL=\"postgresql://...\" in your .env.local"
    echo "  5. Run: cd web && npx prisma migrate dev"
    echo "  6. If migrating existing SQLite data, run: npx tsx scripts/migrate-data.ts"
    echo ""
    echo "See docs/DATABASE.md for full instructions."
    ;;

  postgres)
    echo "📄 Generating PostgreSQL migration SQL..."
    npx prisma migrate diff \
      --from-url "file:./db/custom.db" \
      --to-schema-datamodel prisma/schema.prisma \
      --script > "$BACKUP_DIR/pg_migration_$TIMESTAMP.sql" 2>/dev/null || \
    echo "⚠️  Could not generate SQL diff. Check database connection."
    if [ -f "$BACKUP_DIR/pg_migration_$TIMESTAMP.sql" ]; then
      echo "✅ Migration SQL: $BACKUP_DIR/pg_migration_$TIMESTAMP.sql"
    fi
    ;;

  status)
    echo "📊 Migration Status"
    echo "=================="
    echo ""
    echo "Database Provider: $(grep 'provider' prisma/schema.prisma | head -1 | awk '{print $3}')"
    if [ -f "$SQLITE_DB" ]; then
      echo "SQLite Database:   Present ($(du -h "$SQLITE_DB" | cut -f1))"
    else
      echo "SQLite Database:   Not present"
    fi
    echo ""
    echo "Available Backups:"
    ls -lh "$BACKUP_DIR"/*.db 2>/dev/null | awk '{print "  " $5 "  " $9}' | sed "s|$BACKUP_DIR/||" || echo "  (none)"
    echo ""
    echo "Migration Script:  scripts/migrate-data.ts"
    echo "  - Exists: $( [ -f "$SCRIPT_DIR/migrate-data.ts" ] && echo '✅' || echo '❌' )"
    echo ""
    echo "Next Action:"
    if grep -q 'provider = "sqlite"' prisma/schema.prisma; then
      echo "  → Switch to PostgreSQL:  bash scripts/migrate.sh to-pg"
    else
      echo "  → Already using PostgreSQL ✅"
    fi
    ;;

  help|*)
    echo "Voltium Database Migration Helper"
    echo ""
    echo "Usage: bash scripts/migrate.sh <command>"
    echo ""
    echo "Commands:"
    echo "  backup          Create a backup of the current SQLite database"
    echo "  restore         Restore the latest SQLite backup"
    echo "  to-pg           Show instructions for migrating to PostgreSQL"
    echo "  postgres        Generate PostgreSQL migration SQL"
    echo "  status          Show migration status overview"
    ;;
esac
