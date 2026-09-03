import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function getKeys(filePath: string) {
  const content = readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('=')[0].trim());
}

const envPath = join(process.cwd(), '.env');
const examplePath = join(process.cwd(), '.env.example');

if (!existsSync(examplePath)) {
  console.error('.env.example not found. Please ensure it exists in the root directory.');
  process.exit(1);
}

// P0: CI has no .env file (vars are injected via secrets/env). The old code
// exited 0 when .env was missing — "normal in CI" — so a completely absent
// secret set passed silently. In CI (CI=true or GITHUB_ACTIONS), fall through
// to exampleKeys-vs-process.env check; locally, the warn+exit 0 is fine.
const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
if (!existsSync(envPath) && !isCi) {
  console.warn(
    '.env not found. Skipping verification. (This is normal in CI/CD where env vars are injected)'
  );
  process.exit(0);
}

const exampleKeys = getKeys(examplePath);
let envKeys: Set<string>;
if (isCi && !existsSync(envPath)) {
  // No .env in CI — compare against the injected process.env.
  envKeys = new Set(Object.keys(process.env));
} else {
  envKeys = new Set(getKeys(envPath));
}

const missing = exampleKeys.filter((key) => !envKeys.has(key));

if (missing.length > 0) {
  console.error('❌ Missing environment variables in .env:');
  missing.forEach((key) => console.error(`  - ${key}`));
  console.error('\nPlease update your .env file to include these variables based on .env.example.');
  process.exit(1);
}

// P0: in CI, also enforce secret length for the 6 distinct secrets (16+ was P0-1's floor; 32 is the current prod floor).
if (isCi) {
  const secretFloors: Record<string, number> = {
    JWT_SECRET: 32,
    CRON_SECRET: 32,
    WORKER_SECRET: 32,
    FILE_UPLOAD_SECRET: 32,
    VERIFY_RECEIPT_SECRET: 32,
    DEBUG_SECRET: 32,
  };
  let bad = false;
  for (const [k, min] of Object.entries(secretFloors)) {
    const v = process.env[k] || '';
    if (v.length < min) {
      console.error(`❌ ${k} must be at least ${min} characters (is ${v.length})`);
      bad = true;
    }
  }
  if (bad) process.exit(1);
}

console.log('✅ Environment variables match .env.example');
