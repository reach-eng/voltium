#!/usr/bin/env bash
# =============================================================================
# Voltium — pm2-logrotate Setup (PR-94 / INF-OBS-1)
# =============================================================================
# Installs the pm2-logrotate module and applies the Voltium log-rotation
# policy:
#   - max_size : 50M   (rotate when a log file exceeds 50 MB)
#   - retain   : 14    (keep 14 rotated files per log)
#   - compress : true  (gzip rotated files)
#
# Why these values?
#   - Next.js (`voltium-web`) on a busy day writes ~30-40 MB of access + error
#     logs per worker, so 50 MB strikes a balance between rotation churn
#     and not letting a single file grow unbounded.
#   - 14 files × 50 MB ≈ 700 MB cap per log stream, well under the laptop's
#     disk pressure budget.
#   - compress=true cuts cold-storage by ~10x; gzip'd JSON-ish logs compress
#     very well.
#
# Usage:
#   bash scripts/setup-logrotate.sh
#   bash scripts/setup-logrotate.sh --uninstall   # remove module + config
#
# Requirements:
#   - pm2 in PATH
#   - Run as the same user that owns the pm2 daemon (usually the service
#     user that ran `pm2 start ecosystem.config.js`).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "❌ pm2 not found in PATH. Install with: npm install -g pm2" >&2
  exit 1
fi

MODE="install"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --uninstall)
      MODE="uninstall"
      shift
      ;;
    --help|-h)
      echo "Usage: bash scripts/setup-logrotate.sh [--uninstall]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ "$MODE" = "uninstall" ]; then
  echo "==> Uninstalling pm2-logrotate..."
  pm2 uninstall pm2-logrotate || true
  pm2 delete pm2-logrotate 2>/dev/null || true
  echo "✅ pm2-logrotate uninstalled."
  pm2 save >/dev/null 2>&1 || true
  exit 0
fi

echo "==> Installing pm2-logrotate..."
pm2 install pm2-logrotate

echo "==> Applying Voltium log-rotation policy (max_size=50M, retain=14, compress=true)..."
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
# Belt-and-braces: also enable the worker interval (default 30s) and disable
# the global no-rotate flag. These are pm2-logrotate defaults but we set
# them explicitly so the policy is self-documenting on `pm2 conf`.
pm2 set pm2-logrotate:workerInterval 30
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'  # daily at midnight

pm2 save >/dev/null 2>&1 || true

echo ""
echo "✅ pm2-logrotate configured for Voltium."
echo "   Verify with:  pm2 conf pm2-logrotate"
