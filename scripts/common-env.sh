#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Common Environment & Path Constants for Shell Scripts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Root paths relative to repo root
export MIGRATION_DIR="${MIGRATION_DIR:-web/prisma/migrations}"
export SCHEMA_PATH="${SCHEMA_PATH:-web/prisma/schema.prisma}"
export WEB_DIR="${WEB_DIR:-web}"
export FLUTTER_DIR="${FLUTTER_DIR:-flutter}"

# Utility functions for script status logging
log_info() {
  echo "[INFO] $1"
}

log_ok() {
  echo "[OK] $1"
}

log_error() {
  echo "[ERROR] $1" >&2
}
