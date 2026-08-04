#!/usr/bin/env bash
# =============================================================================
# Voltium — Secret Rotation Check (PR-139 / INF-CI/CD-4)
# =============================================================================
# Thin shell wrapper around the TypeScript check.
# Phase 6F (PR-94) added scripts/check-secret-rotation.ts and wired the
# nightly cron job. The daily ci-cd.yml step at .github/workflows/ci-cd.yml:162
# was referencing this .sh file but it never existed — the step was a silent
# no-op (masked by check-migration-safety.sh running earlier). This file
# closes that gap.
#
# Usage:
#   bash scripts/check-secret-rotation.sh
#
# Exit codes:
#   0 — all secrets within rotation window
#   1 — at least one secret is stale (will also write to stderr)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Run the TypeScript implementation. We `cd web` first because the .ts file
# imports from web/src/ via the vitest test, but the runtime import path
# `../../src/lib/secret-rotation` is relative to the script's own location.
# When run from the repo root via `bash scripts/...`, npx tsx executes the
# script in-place and the relative import resolves correctly.
exec npx tsx "$SCRIPT_DIR/check-secret-rotation.ts"
