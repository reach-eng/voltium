import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Audit OpenAPI route coverage
console.log('Auditing OpenAPI route coverage against route.ts files...');
execSync('npm run audit:openapi', { stdio: 'inherit' });

// Generate OpenAPI spec
console.log('Generating OpenAPI spec...');
execSync('npm run generate:openapi', { stdio: 'inherit' });

// Check git status of openapi.json
console.log('Checking for drift in openapi.json...');
const status = execSync('git diff --name-only src/contracts/openapi.json').toString().trim();

if (status) {
  console.error('❌ Drift detected! openapi.json is out of date.');
  console.error('Please run `npm run generate:openapi` and commit the changes.');
  process.exit(1);
} else {
  console.log('✅ No drift detected. openapi.json is up to date.');
  process.exit(0);
}
