#!/usr/bin/env bash
# TLS Certificate Setup for Local Development
# Uses mkcert to create locally-trusted development certificates.
#
# Prerequisites:
#   brew install mkcert        # macOS
#   choco install mkcert       # Windows (choco)
#   sudo apt install mkcert    # Linux (or libnss3-tools + download)
#
# Run from the web/ directory:
#   bash ../bin/cert-setup.sh

set -euo pipefail

CERT_DIR="$(cd "$(dirname "$0")/.." && pwd)/certs"
mkdir -p "$CERT_DIR"

# Install local CA if not already installed
if ! mkcert -install 2>/dev/null; then
  echo "⚠️  mkcert not found. Install it first:"
  echo "   macOS: brew install mkcert"
  echo "   Windows: choco install mkcert"
  echo "   Linux: sudo apt install mkcert libnss3-tools"
  echo ""
  echo "   Creating self-signed certificates instead (browser will show warning)..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/dev.key" \
    -out "$CERT_DIR/dev.crt" \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
  echo "✅ Self-signed certificates created in $CERT_DIR/"
  echo "   cert: $CERT_DIR/dev.crt"
  echo "   key:  $CERT_DIR/dev.key"
  exit 0
fi

# Generate certificates for localhost
mkcert -key-file "$CERT_DIR/dev.key" -cert-file "$CERT_DIR/dev.crt" \
  localhost 127.0.0.1 ::1

echo ""
echo "✅ TLS certificates created in $CERT_DIR/"
echo "   cert: $CERT_DIR/dev.crt"
echo "   key:  $CERT_DIR/dev.key"
echo ""
echo "To start with HTTPS:"
echo "   npx tsx bin/start-with-tls.ts"
echo ""
echo "Or set in .env:"
echo "   TLS_CERT_PATH=$CERT_DIR/dev.crt"
echo "   TLS_KEY_PATH=$CERT_DIR/dev.key"
echo "   NEXT_PUBLIC_APP_URL=https://localhost:8081"
