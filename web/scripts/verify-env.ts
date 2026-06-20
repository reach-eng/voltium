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

if (!existsSync(envPath)) {
  console.warn(
    '.env not found. Skipping verification. (This is normal in CI/CD where env vars are injected)'
  );
  process.exit(0);
}

const exampleKeys = getKeys(examplePath);
const envKeys = new Set(getKeys(envPath));

const missing = exampleKeys.filter((key) => !envKeys.has(key));

if (missing.length > 0) {
  console.error('❌ Missing environment variables in .env:');
  missing.forEach((key) => console.error(`  - ${key}`));
  console.error('\nPlease update your .env file to include these variables based on .env.example.');
  process.exit(1);
}

console.log('✅ Environment variables match .env.example');
