#!/usr/bin/env bash
# Cross-platform Voltium Service Manager
# Usage: bash scripts/service.sh <command>
# Commands: start, stop, restart, status, health, preflight, build
#
# This is a convenience wrapper for macOS/Linux environments.
# NOTE: laptop-service.ps1 is the authoritative orchestrator for the local service.
#
# Works on macOS, Linux, and Windows (via WSL/Git Bash).

set -euo pipefail

SERVER_ROOT="${VOLTIUM_SERVER_ROOT:-/opt/voltium}"
WEB_DIR="$(cd "$(dirname "$0")/../web" && pwd)"
LOGS_DIR="${VOLTIUM_LOG_ROOT:-$SERVER_ROOT/data/logs}"
PM2="${PM2_PATH:-$(which pm2 2>/dev/null || echo './node_modules/.bin/pm2')}"

mkdir -p "$LOGS_DIR"

command="${1:-status}"

case "$command" in
  preflight)
    echo "🔍 Preflight check..."
    ERRORS=0
    echo "  Server root: $SERVER_ROOT"
    echo "  Web dir:     $WEB_DIR"
    echo "  Logs dir:    $LOGS_DIR"

    # Check PostgreSQL
    if command -v pg_isready &>/dev/null; then
      if pg_isready -q; then
        echo "  PostgreSQL:  ✅ running"
      else
        echo "  PostgreSQL:  ❌ not running"
        ERRORS=1
      fi
    else
      echo "  PostgreSQL:  ⚠️  check manually"
    fi

    # Check Node.js
    if node --version &>/dev/null; then
      echo "  Node.js:     $(node --version)"
    else
      echo "  Node.js:     ❌ not found"
      ERRORS=1
    fi

    # Check npm
    if npm --version &>/dev/null; then
      echo "  npm:         $(npm --version)"
    else
      echo "  npm:         ❌ not found"
      ERRORS=1
    fi

    # Check ports
    if ss -tlnp 2>/dev/null | grep -q :8081; then
      echo "  Port 8081:   in use"
    else
      echo "  Port 8081:   free"
    fi

    # Check storage
    for dir in "$SERVER_ROOT/data/uploads" "$SERVER_ROOT/data/backups"; do
      if [ -d "$dir" ]; then
        echo "  $(basename "$dir"): ✅ $(df -h "$dir" 2>/dev/null | tail -1 | awk '{print $4}') free"
      else
        echo "  $(basename "$dir"): ⚠️  not found"
      fi
    done

    if [ "$ERRORS" -gt 0 ]; then
      echo "❌ Preflight failed. Please resolve the errors above."
      exit 1
    fi
    echo "✅ Preflight passed"
    ;;

  build)
    echo "🔨 Building..."
    cd "$WEB_DIR"
    npm run build
    npm run worker:build
    echo "✅ Build complete"
    ;;

  start)
    echo "🚀 Starting services..."
    cd "$WEB_DIR"
    npx pm2 start ../ecosystem.config.js 2>&1
    npx pm2 save 2>&1
    echo "✅ Services started"
    ;;

  stop)
    echo "🛑 Stopping services..."
    cd "$WEB_DIR"
    npx pm2 stop ../ecosystem.config.js 2>&1
    echo "✅ Services stopped"
    ;;

  restart)
    echo "🔄 Restarting services..."
    cd "$WEB_DIR"
    npx pm2 restart ../ecosystem.config.js 2>&1
    echo "✅ Services restarted"
    ;;

  status)
    echo "📊 Service Status:"
    cd "$WEB_DIR"
    npx pm2 status 2>&1 || echo "PM2 not running"
    ;;

  health)
    echo "🏥 Health check..."
    curl -sf http://localhost:8081/api/health 2>/dev/null | python3 -m json.tool 2>/dev/null || \
      echo "❌ Health endpoint unreachable"
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|status|health|preflight|build}"
    exit 1
    ;;
esac
