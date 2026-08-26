#!/usr/bin/env bash
# Voltium One-Command Laptop Bootstrap
#
# Automates the full setup from a clean machine:
#   1. Install prerequisites (Node.js, PostgreSQL, Cloudflare)
#   2. Clone the repository
#   3. Install npm dependencies
#   4. Generate secrets
#   5. Create PostgreSQL database + user
#   6. Run Prisma migrations
#   7. Create data directories
#   8. Build the project
#   9. Start PM2 services
#  10. Configure Cloudflare Tunnel
#
# Usage: bash scripts/bootstrap.sh [--no-tunnel] [--dev]
#
# Options:
#   --no-tunnel   Skip Cloudflare Tunnel setup
#   --dev         Set up for development (no PM2, dev env)
#
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────
REPO_URL="${VOLTIUM_REPO:-https://github.com/voltium/voltium.git}"
REPO_DIR="${VOLTIUM_DIR:-$HOME/voltium}"
DB_NAME="${VOLTIUM_DB:-voltium}"
DB_USER="${VOLTIUM_DB_USER:-voltium}"
DB_PASS="${VOLTIUM_DB_PASS:-$(openssl rand -base64 24)}"
JWT_SECRET="${VOLTIUM_JWT_SECRET:-$(openssl rand -base64 48)}"
CRON_SECRET="${VOLTIUM_CRON_SECRET:-$(openssl rand -base64 32)}"
WORKER_SECRET="${VOLTIUM_WORKER_SECRET:-$(openssl rand -base64 32)}"
SERVER_ROOT="${VOLTIUM_SERVER_ROOT:-$HOME/voltium-server}"
NODE_VERSION="20"
SKIP_TUNNEL=false
DEV_MODE=false

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}✅${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠️${NC} $1"; }
err()   { echo -e "${RED}❌${NC} $1"; }
step()  { echo -e "\n${YELLOW}━━━ Step ${1}: ${2} ━━━${NC}"; }

# Parse args
for arg in "$@"; do
  case "$arg" in --no-tunnel) SKIP_TUNNEL=true ;; --dev) DEV_MODE=true ;; esac
done

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       Voltium Laptop Bootstrap              ║"
echo "╚══════════════════════════════════════════════╝"
echo "  Server root: $SERVER_ROOT"
echo "  DB name:     $DB_NAME"
echo "  Repo dir:    $REPO_DIR"
echo "  Mode:        $([ "$DEV_MODE" = true ] && echo 'Development' || echo 'Production')"
echo ""

# ── Step 1: Check prerequisites ────────────────────────────────────────
step 1 "Checking prerequisites"

if ! command -v node &>/dev/null; then
  warn "Node.js not found. Installing via nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install "$NODE_VERSION"
  nvm use "$NODE_VERSION"
fi
info "Node.js $(node --version)"

if ! command -v npm &>/dev/null; then
  err "npm not found after Node.js install"
  exit 1
fi
info "npm $(npm --version)"

if ! command -v psql &>/dev/null; then
  warn "PostgreSQL not found. Installing..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install postgresql@16
    brew services start postgresql@16
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo apt-get update -qq && sudo apt-get install -y -qq postgresql postgresql-contrib
    sudo service postgresql start
  else
    err "Unsupported OS. Install PostgreSQL manually."
    exit 1
  fi
fi
info "PostgreSQL $(psql --version 2>/dev/null | head -1 || echo 'installed')"

if ! command -v git &>/dev/null; then
  warn "Git not found. Installing..."
  if [[ "$OSTYPE" == "darwin"* ]]; then brew install git
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then sudo apt-get install -y -qq git; fi
fi
info "Git $(git --version 2>/dev/null)"

# ── Step 2: Clone repo ─────────────────────────────────────────────────
step 2 "Cloning repository"
if [ -d "$REPO_DIR" ]; then
  info "Repository already exists at $REPO_DIR"
else
  git clone "$REPO_URL" "$REPO_DIR"
  info "Repository cloned to $REPO_DIR"
fi
cd "$REPO_DIR"

# ── Step 3: Create data directories ────────────────────────────────────
step 3 "Creating data directories"
mkdir -p "$SERVER_ROOT/data/uploads" "$SERVER_ROOT/data/backups" "$SERVER_ROOT/data/logs"
info "Data directories created under $SERVER_ROOT"

# ── Step 4: Create .env ────────────────────────────────────────────────
step 4 "Creating environment configuration"
ENV_FILE="$REPO_DIR/web/.env"
if [ -f "$ENV_FILE" ]; then
  warn ".env already exists — skipping (delete to regenerate)"
else
  cat > "$ENV_FILE" << EOF
NODE_ENV=$([ "$DEV_MODE" = true ] && echo 'development' || echo 'production')
APP_ENV=$([ "$DEV_MODE" = true ] && echo 'development' || echo 'production')
DATA_MODE=local_laptop

DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public
DIRECT_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public

JWT_SECRET=$JWT_SECRET
CRON_SECRET=$CRON_SECRET
WORKER_SECRET=$WORKER_SECRET

STORAGE_PROVIDER=local
LOCAL_STORAGE_ROOT=$SERVER_ROOT/data/uploads
BACKUP_ROOT=$SERVER_ROOT/data/backups

NEXT_PUBLIC_APP_URL=$([ "$DEV_MODE" = true ] && echo 'http://localhost:8081' || echo 'https://dev.voltium.app')
RATE_LIMIT_STORE_PROVIDER=postgres
ALERT_WEBHOOK_URL=
ALERT_MIN_LEVEL=error
EOF
  # R10 polish #5 (§5.2): restrict .env to owner-only. Skipped on Windows
  # (chmod is a no-op on NTFS ACLs; PowerShell Set-Acl would be needed there).
  if [ "$(uname -s)" != "MINGW"* ] && [ "$(uname -s)" != "CYGWIN"* ]; then
    chmod 600 "$ENV_FILE"
    info ".env created with auto-generated secrets (mode 600)"
  else
    info ".env created with auto-generated secrets (skipping chmod on Windows)"
  fi
fi

# ── Step 5: Create PostgreSQL database ─────────────────────────────────
step 5 "Setting up PostgreSQL database"
if psql -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  warn "Database '$DB_NAME' already exists"
else
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || \
    psql -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || \
    psql -U postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  info "Database '$DB_NAME' created with user '$DB_USER'"
fi

# ── Step 6: Install dependencies ───────────────────────────────────────
step 6 "Installing npm dependencies"
cd "$REPO_DIR/web"
npm ci --omit=dev 2>/dev/null || npm install
info "npm dependencies installed"

# ── Step 7: Prisma migrations ──────────────────────────────────────────
step 7 "Running database migrations"
npx prisma generate
npx prisma migrate deploy 2>/dev/null || npx prisma db push
info "Database schema applied"

# ── Step 8: Build the project ──────────────────────────────────────────
step 8 "Building the project"
npm run build
info "Build complete"

# ── Step 9: Start PM2 services ─────────────────────────────────────────
step 9 "Starting PM2 services"
if [ "$DEV_MODE" = false ]; then
  npx pm2 start ../ecosystem.config.js 2>/dev/null || true
  npx pm2 save 2>/dev/null || true
  info "PM2 services started"
else
  warn "Dev mode — skipping PM2 start"
fi

# ── Step 10: Cloudflare Tunnel ─────────────────────────────────────────
step 10 "Configuring Cloudflare Tunnel"
if [ "$SKIP_TUNNEL" = false ] && [ "$DEV_MODE" = false ]; then
  if command -v cloudflared &>/dev/null; then
    warn "Cloudflare Tunnel setup requires manual login:"
    echo "   cloudflared tunnel login"
    echo "   cloudflared tunnel create voltium"
    echo "   cloudflared tunnel route dns voltium dev.voltium.app"
  else
    warn "cloudflared not found. Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  fi
else
  warn "Skipping Cloudflare Tunnel"
fi

# ── Done ────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       ✅ Bootstrap Complete!                 ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  Server root:  $SERVER_ROOT"
echo "  App URL:      http://localhost:8081"
echo "  Admin login:  Use the admin auth route"
echo ""
echo "  Generated secrets (save these!):"
echo "    DB Password:     $DB_PASS"
echo "    JWT Secret:      $JWT_SECRET"
echo "    CRON Secret:     $CRON_SECRET"
echo "    Worker Secret:   $WORKER_SECRET"
echo ""
echo "  Commands:"
echo "    Status:  cd $REPO_DIR/web && npx pm2 status"
echo "    Logs:    cd $REPO_DIR/web && npx pm2 logs"
echo "    Stop:    cd $REPO_DIR/web && npx pm2 stop ../ecosystem.config.js"
echo ""
