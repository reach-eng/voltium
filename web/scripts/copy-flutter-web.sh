#!/bin/bash
set -e
FLUTTER_WEB_DIR="../flutter/build/web"
TARGET_DIR="public/rider-app"

echo "==> Copying Flutter web build to $TARGET_DIR"
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

if [ -d "$FLUTTER_WEB_DIR" ]; then
  cp -r "$FLUTTER_WEB_DIR"/* "$TARGET_DIR/"
  if [ -f "$TARGET_DIR/index.html" ]; then
    echo "[OK] Flutter web build copied to $TARGET_DIR"
    echo "     Accessible at: http://localhost:8081/rider-app/"
  else
    echo "[FAIL] index.html not found in target directory"
    exit 1
  fi
else
  echo "[FAIL] Flutter web build output directory not found at $FLUTTER_WEB_DIR"
  echo "       Please run 'flutter build web --release --base-href \"/rider-app/\"' first."
  exit 1
fi
