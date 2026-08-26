const fs = require('fs');
const path = require('path');

const OPENAPI_PATH = path.join(__dirname, '../src/contracts/openapi.json');
const TEST_DIRS = [
  path.join(__dirname, '../tests/integration'),
  path.join(__dirname, '../tests/api'),
  path.join(__dirname, '../tests/security'),
];
const TEST_FILES = [
  path.join(__dirname, '../tests/api-routes.test.ts'),
];

// Exclusions as per plan
const EXCLUSIONS = [
  '/api/health',
  '/api/internal',
  '/api/cron',
  '/api/metrics',
  '/api/monitoring/metrics',
  '/api/rider/register-token',
  '/api/files',
];

function isExcluded(routePath) {
  return EXCLUSIONS.some(ex => routePath.startsWith(ex));
}

function getAllTestFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllTestFiles(fullPath, arrayOfFiles);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.js')) {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

async function run() {
  if (!fs.existsSync(OPENAPI_PATH)) {
    console.error(`Error: Could not find ${OPENAPI_PATH}`);
    process.exit(1);
  }

  const openapi = JSON.parse(fs.readFileSync(OPENAPI_PATH, 'utf-8'));
  const operations = [];

  for (const [routePath, methods] of Object.entries(openapi.paths)) {
    if (isExcluded(routePath)) continue;

    // Convert OpenAPI path /api/admin/tickets/{id}/messages → /api/admin/tickets/
    // so we can match test references like /api/admin/tickets/${id}/messages.
    // We strip all path segments after the first {param}, AND collapse any
    // double-slash that the strip leaves behind.
    // Old buggy logic left a "//" in the basePath which never matched anything.
    const firstParam = routePath.indexOf('{');
    const basePath = firstParam === -1
      ? routePath.replace(/\/$/, '')
      : routePath.slice(0, firstParam).replace(/\/+$/, '/');

    for (const method of Object.keys(methods)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        operations.push({
          method: method.toUpperCase(),
          routePath,
          basePath,
          covered: false,
        });
      }
    }
  }

  const allTestFiles = [...TEST_FILES];
  for (const dir of TEST_DIRS) {
    allTestFiles.push(...getAllTestFiles(dir));
  }

  let totalContent = '';
  for (const file of allTestFiles) {
    if (fs.existsSync(file)) {
      totalContent += fs.readFileSync(file, 'utf-8') + '\n';
    }
  }

  let uncovered = 0;
  for (const op of operations) {
    // A simple heuristic: check if the basePath is mentioned in the test files
    if (totalContent.includes(op.basePath) || totalContent.includes(op.routePath)) {
      op.covered = true;
    } else {
      uncovered++;
      console.log(`[UNCOVERED] ${op.method} ${op.routePath}`);
    }
  }

  console.log(`\nCoverage Check Summary:`);
  console.log(`Total Operations (excluding skipped): ${operations.length}`);
  console.log(`Covered Operations (heuristic): ${operations.length - uncovered}`);
  console.log(`Uncovered Operations: ${uncovered}`);

  // ━ Ticket #38 hardening: hard-fail on uncovered operations ━
  // Old behavior: process.exit(0) regardless of uncovered count (SOFT WARNING).
  // Audit found that CI was silently passing on coverage regressions.
  // New behavior: exit 1 when uncovered > 0.
  //
  // Emergency override: set ALLOW_COVERAGE_GAP=1 to downgrade to a warning
  // (for hot-fixes where the gap is a known false positive).
  if (uncovered > 0) {
    if (process.env.ALLOW_COVERAGE_GAP === '1') {
      console.log(`\n⚠️  COVERAGE GAP OVERRIDE: ALLOW_COVERAGE_GAP=1 set — gap is logged but not enforced.`);
      console.log(`    Do not use this in normal CI. Emergency-only.`);
      process.exit(0);
    }
    console.log(`\n❌ COVERAGE GAP: There are ${uncovered} uncovered operations.`);
    console.log(`   Add integration tests, or set ALLOW_COVERAGE_GAP=1 to bypass.`);
    process.exit(1);
  }

  console.log(`\n✅ All operations are covered by integration tests!`);
  process.exit(0);
}

run().catch(console.error);
