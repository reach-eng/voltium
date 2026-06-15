#!/bin/bash
# Generate Flutter API client from OpenAPI spec
# Prerequisites: npm packages installed, Java 11+ available (for openapi-generator)
#
# Usage: bash scripts/generate-flutter-client.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
FLUTTER_DIR="$ROOT_DIR/../flutter"
OPENAPI_JSON="$ROOT_DIR/src/contracts/openapi.json"

echo "=== Generating Flutter API Client ==="
echo "OpenAPI spec: $OPENAPI_JSON"
echo "Flutter output: $FLUTTER_DIR/lib/generated"

# Step 1: Regenerate OpenAPI JSON from the TypeScript generator
echo ""
echo "[1/3] Regenerating OpenAPI JSON..."
cd "$ROOT_DIR"
npx tsx src/contracts/openapi.ts

# Step 2: Generate Dart API client using openapi-generator
echo ""
echo "[2/3] Generating Dart API client..."
GENERATED_DIR="$FLUTTER_DIR/lib/generated"
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
# Remove the generated pubspec and test files — we only need the API classes
rm -f "$GENERATED_DIR/pubspec.yaml" "$GENERATED_DIR/README.md" "$GENERATED_DIR/.openapi-generator-ignore"
rm -rf "$GENERATED_DIR/test" "$GENERATED_DIR/.openapi-generator" 2>/dev/null || true

echo ""
echo "=== Flutter API Client Generated ==="
echo "Output: $FLUTTER_DIR/lib/generated/"
echo ""
echo "Next steps:"
echo "  1. Import the generated client: import 'package:voltium_app/generated/api.dart';"
echo "  2. Replace manual ApiService calls with generated client methods"
