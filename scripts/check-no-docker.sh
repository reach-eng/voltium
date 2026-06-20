#!/usr/bin/env bash
# =============================================================================
# Voltium � No-Docker Enforcement Check
# =============================================================================
# Fails if any Docker files or Docker commands are found in the project.
# Run this in CI to prevent Docker from being re-introduced.
#
# Usage:
#   bash scripts/check-no-docker.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

FLUTTER_ONLY=0
for arg in "$@"; do
  if [ "$arg" = "--flutter-only" ]; then
    FLUTTER_ONLY=1
  fi
done

echo "Checking for Docker files and commands in: $PROJECT_DIR (flutter-only: $FLUTTER_ONLY)"
echo ""

FOUND=0

# -- Check for Docker files ---------------------------------------------------
DOCKER_FILES=$(find "$PROJECT_DIR" \
  \( -name ".git" -o -name "node_modules" -o -name ".next" -o -name "build" -o -name ".dart_tool" \) -prune \
  -o \( -iname "*Dockerfile*" -o -iname "*docker-compose*" -o -name ".dockerignore" \) \
  -print 2>/dev/null || true)

if [ -n "$DOCKER_FILES" ]; then
  echo "FAIL: Docker files found:"
  echo "$DOCKER_FILES"
  FOUND=1
else
  echo "PASS: No Docker files found"
fi

echo ""

# -- Check for Docker commands in source files --------------------------------
EXCLUDE_DIRS="--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=build --exclude-dir=.dart_tool --exclude-dir=.codex-review --exclude-dir=.github"

DOCKER_REFS=$(grep -RIn \
  $EXCLUDE_DIRS \
  --exclude="check-no-docker.sh" \
  -E "docker build|docker compose|docker-compose up|docker-compose down|docker-compose build|docker run |docker ps|docker logs|docker pull|image:[[:space:]]*postgres" \
  "$PROJECT_DIR" 2>/dev/null || true)

if [ -n "$DOCKER_REFS" ]; then
  echo "FAIL: Docker command references found:"
  echo "$DOCKER_REFS"
  FOUND=1
else
  echo "PASS: No Docker command references found"
fi

echo ""

if [ "$FOUND" -eq 1 ]; then
  echo "FAIL: Docker files or commands found."
  echo ""
  echo "  Voltium does not use Docker for local development, CI, staging,"
  echo "  or production. Local services use native PostgreSQL and native"
  echo "  Node.js/PM2 process commands."
  echo ""
  echo "  Remove the Docker references above and try again."
  exit 1
else
  echo "PASS: No Docker files or commands found. Project is Docker-free."
  exit 0
fi
