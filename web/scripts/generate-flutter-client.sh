#!/bin/bash
# Generate Flutter API client from OpenAPI spec
# Prerequisites: npm packages installed, Java 11+ available (for openapi-generator)
#
# Usage: bash scripts/generate-flutter-client.sh
#
# Output: flutter/lib/core/network/generated/{api_client,api_models}.dart
# (replaces the existing hand-maintained generated client).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
FLUTTER_DIR="$ROOT_DIR/../flutter"
OPENAPI_JSON="$ROOT_DIR/src/contracts/openapi.json"
GENERATED_DIR="$FLUTTER_DIR/lib/core/network/generated"

echo "=== Generating Flutter API Client ==="
echo "OpenAPI spec: $OPENAPI_JSON"
echo "Flutter output: $GENERATED_DIR"

# Step 1: Regenerate OpenAPI JSON from the TypeScript generator
echo ""
echo "[1/3] Regenerating OpenAPI JSON..."
cd "$ROOT_DIR"
npx tsx src/contracts/openapi.ts

# Step 2: Generate Dart API client using openapi-generator
echo ""
echo "[2/3] Generating Dart API client..."
mkdir -p "$GENERATED_DIR"

npx @openapitools/openapi-generator-cli generate \
  -i "$OPENAPI_JSON" \
  -g dart \
  -o "$GENERATED_DIR" \
  --additional-properties=pubName=voltium_api_client \
  --skip-validate-spec \
  2>&1

# Step 3: Clean up generated files that conflict with existing code
echo ""
echo "[3/3] Cleaning up generated output..."
# Remove the generated pubspec, README, and example folders — we only
# need the API classes (api_client.dart, api_models.dart, lib/).
rm -f "$GENERATED_DIR/pubspec.yaml" "$GENERATED_DIR/README.md" "$GENERATED_DIR/.openapi-generator-ignore"
rm -rf "$GENERATED_DIR/test" "$GENERATED_DIR/.openapi-generator" "$GENERATED_DIR/doc" "$GENERATED_DIR/example" 2>/dev/null || true

echo ""
echo "=== Flutter API Client Generated ==="
echo "Output: $GENERATED_DIR/api_client.dart"
echo "        $GENERATED_DIR/api_models.dart"
echo ""
echo "Next steps:"
echo "  1. Verify the diff vs HEAD: git diff flutter/lib/core/network/generated/"
echo "  2. If happy, commit the regenerated client."
