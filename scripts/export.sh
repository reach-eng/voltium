#!/bin/bash
# Voltium — Clean ZIP Export Script
# Generates a ZIP archive of the project suitable for sharing/review.
# Preserves folder structure so route.ts files don't collide.
#
# Usage:
#   bash scripts/export.sh                    # Creates voltium-src.tar.gz
#   bash scripts/export.sh --format zip       # Creates voltium-src.zip

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_NAME="voltium-src"
FORMAT="${2:-tar}"

echo "📦 Exporting Voltium source from: $PROJECT_DIR"

# Change to project root
cd "$PROJECT_DIR"

# Exclusions list
EXCLUDES=(
  "--exclude=.git"
  "--exclude=node_modules"
  "--exclude=.dart_tool"
  "--exclude=build"
  "--exclude=.next"
  "--exclude=flutter/build"
  "--exclude=flutter/.dart_tool"
  "--exclude=flutter/android/.gradle"
  "--exclude=flutter/ios/build"
  "--exclude=reports"
  "--exclude=logs"
  "--exclude=scratch"
  "--exclude=.env"
  "--exclude=.env.*"
  "--exclude=*.db"
  "--exclude=*.sqlite"
  "--exclude=*.sqlite3"
  "--exclude=*.sql"
  "--exclude=upload"
  "--exclude=download"
  "--exclude=backups"
  "--exclude=.kilo"
  "--exclude=.opencode"
  "--exclude=.qodo"
  "--exclude=graphify-out"
  "--exclude=screenshots"
  "--exclude=flutter/screenshots"
  "--exclude=flutter/logs"
  "--exclude=flutter/reports"
  "--exclude=flutter/pubspec.lock"
  "--exclude=flutter/.flutter-plugins*"
  # Docker files should never be in exports
  "--exclude=*Dockerfile*"
  "--exclude=*docker-compose*"
  "--exclude=.dockerignore"
  "--exclude=scripts/legacy"
  # Debug / test artifacts
  "--exclude=flutter/artifacts"
  "--exclude=flutter/debug"
  "--exclude=playwright-report"
  "--exclude=test-results"
  "--exclude=web/dist"
  "--exclude=*.tsbuildinfo"
  "--exclude=*.zip"
  "--exclude=scratch_*"
)

if [ "$FORMAT" = "zip" ]; then
  # Requires 7z or zip
  if command -v 7z &>/dev/null; then
    7z a -tzip "${OUTPUT_NAME}.zip" . "${EXCLUDES[@]}" -xr!".DS_Store" -xr!"*.log"
  elif command -v zip &>/dev/null; then
    # zip -x patterns — keep in sync with EXCLUDES array above
    zip -r "${OUTPUT_NAME}.zip" . \
      -x ".git/*" ".gitignore" ".gitattributes" \
      -x "node_modules/*" \
      -x ".dart_tool/*" \
      -x "build/*" ".next/*" "flutter/build/*" "flutter/.dart_tool/*" "flutter/android/.gradle/*" "flutter/ios/build/*" \
      -x "reports/*" "logs/*" "scratch/*" \
      -x ".env" ".env.*" "!.env.example" "!.env.local.example" "!.env.staging.example" "!.env.production.example" \
      -x "*.db" "*.sqlite" "*.sqlite3" "*.sql" \
      -x "upload/*" \
      -x "download/*" "backups/*" ".kilo/*" ".opencode/*" ".qodo/*" \
      -x "flutter/pubspec.lock" "flutter/.flutter-plugins*" \
      -x "*Dockerfile*" "*docker-compose*" ".dockerignore" \
      -x ".DS_Store" "*.log" \
      -x "graphify-out/*" "flutter/screenshots/*" "flutter/logs/*" "flutter/reports/*" \
      -x "screenshots/*" \
      -x "scripts/legacy/*" \
      -x "flutter/artifacts/*" "flutter/debug/*" "playwright-report/*" \
      -x "test-results/*" "web/dist/*" "*.tsbuildinfo"
  else
    echo "❌ No ZIP tool found. Install 7z or zip."
    exit 1
  fi
  echo "✅ Created: ${OUTPUT_NAME}.zip"
  ls -lh "${OUTPUT_NAME}.zip"
else
  tar -czf "${OUTPUT_NAME}.tar.gz" \
    "${EXCLUDES[@]}" \
    --exclude=".DS_Store" \
    --exclude="*.log" \
    .
  echo "✅ Created: ${OUTPUT_NAME}.tar.gz"
  ls -lh "${OUTPUT_NAME}.tar.gz"
fi
