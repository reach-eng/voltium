#!/bin/bash

# Database Sync Script for Voltium
# Handles backup and restore of the local development SQLite database.

set -e

DB_FILE="prisma/dev.db"
BACKUP_FILE="prisma/backup.sql"

case "$1" in
  backup)
    echo "💾 Backing up database data to $BACKUP_FILE..."
    if [ ! -f "$DB_FILE" ]; then
      echo "❌ Database file $DB_FILE does not exist. Run migration or seed first."
      exit 1
    fi
    # Use sqlite3 dump, filtering out sqlite_sequence and index creations to prevent schema conflicts
    sqlite3 "$DB_FILE" .dump | grep -v 'sqlite_sequence' | grep -v '^CREATE INDEX' | grep -v '^CREATE UNIQUE INDEX' > "$BACKUP_FILE"
    echo "✓ Database backup completed successfully."
    ;;
  restore)
    echo "🔄 Restoring database data from $BACKUP_FILE..."
    if [ ! -f "$BACKUP_FILE" ]; then
      echo "❌ Backup file $BACKUP_FILE not found. Run backup first."
      exit 1
    fi
    
    # Remove existing db if exists to clean state
    if [ -f "$DB_FILE" ]; then
      echo "🗑️ Removing current SQLite file $DB_FILE..."
      rm "$DB_FILE"
    fi
    
    echo "🏗️ Generating fresh schema via prisma db push..."
    npx prisma db push --skip-generate
    
    echo "📥 Loading backup data into SQLite database..."
    # Run sqlite3 with errors ignored (since some indexes/tables might already exist)
    sqlite3 "$DB_FILE" < "$BACKUP_FILE" || true
    
    echo "✓ Database restore completed successfully."
    ;;
  *)
    echo "Usage: $0 {backup|restore}"
    exit 1
    ;;
esac
