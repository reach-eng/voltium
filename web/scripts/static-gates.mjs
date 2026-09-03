import { execFileSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const WEB_ROOT = process.cwd();
const ROOT = path.resolve(WEB_ROOT, '..');
const gate = process.argv[2] || '';
const args = new Set(process.argv.slice(3));
const flutterOnly = args.has('--flutter-only');

const skipDirs = new Set([
  '.git',
  'node_modules',
  '.next',
  'build',
  '.dart_tool',
  'dist',
  '.kilo',
  '.opencode',
  '.saropa',
  '.idea',
  '.codex-review',
  'rider-app',
  'docs',
  'graphify-out',
  '.cosy',
  '.gemini',
  '.qoder',
  '.agents',
  '.claude',
  '.commandcode',
  '.freebuff',
  '.runtime',
  '.trash',
  'logs',
  'chromedriver',
]);

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function logPass(message) {
  console.log(`PASS: ${message}`);
}

function logFail(message) {
  console.error(`FAIL: ${message}`);
}

function isGitIgnored(file) {
  try {
    execFileSync('git', ['check-ignore', '-q', file], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function walk(dir, visitor) {
  const base = path.basename(dir);
  if (skipDirs.has(base)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) walk(full, visitor);
    } else {
      visitor(full);
    }
  }
}

function grepFiles(regex, options = {}) {
  const hits = [];
  const excludeFiles = options.excludeFiles || new Set();
  const excludeDirs = options.excludeDirs || new Set();

  function scan(dir) {
    const base = path.basename(dir);
    if (skipDirs.has(base) || excludeDirs.has(base)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(full);
        continue;
      }
      if (excludeFiles.has(entry.name)) continue;
      if (isBinaryLike(entry.name)) continue;
      let text = '';
      try {
        text = readdirSafeText(full);
      } catch {
        continue;
      }
      const lines = text.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (regex.test(line)) hits.push(`${rel(full)}:${index + 1}:${line.trim()}`);
      });
    }
  }

  scan(ROOT);
  return hits;
}

function readdirSafeText(file) {
  const size = statSync(file).size;
  if (size > 2_000_000) return '';
  const buffer = readFileSync(file);
  if (buffer.includes(0)) return '';
  return buffer.toString('utf8');
}

function isBinaryLike(fileName) {
  return /\.(png|jpe?g|gif|webp|ico|zip|pdf|otf|ttf|woff2?|wasm|dll|exe|bin)$/i.test(fileName);
}

function requireFile(relativePath, state) {
  if (flutterOnly && relativePath.startsWith('web/')) return;
  const full = path.join(ROOT, relativePath);
  if (existsSync(full)) {
    logPass(relativePath);
  } else {
    logFail(`missing ${relativePath}`);
    state.failed = true;
  }
}

function checkNoDocker() {
  const state = { failed: false };
  console.log(`Checking for Docker files and commands in: ${ROOT} (flutter-only: ${Number(flutterOnly)})`);

  const dockerFiles = [];
  walk(ROOT, (file) => {
    const name = path.basename(file).toLowerCase();
    if (name.includes('dockerfile') || name.includes('docker-compose') || name === '.dockerignore') {
      dockerFiles.push(rel(file));
    }
  });

  if (dockerFiles.length) {
    logFail(`Docker files found:\n${dockerFiles.join('\n')}`);
    state.failed = true;
  } else {
    logPass('No Docker files found');
  }

  const refs = grepFiles(/docker build|docker compose|docker-compose up|docker-compose down|docker-compose build|docker run |docker ps|docker logs|docker pull|image:\s*postgres/i, {
    excludeFiles: new Set(['check-no-docker.sh', 'static-gates.mjs']),
    excludeDirs: new Set(['.github']),
  });

  if (refs.length) {
    logFail(`Docker command references found:\n${refs.join('\n')}`);
    state.failed = true;
  } else {
    logPass('No Docker command references found');
  }

  return state.failed ? 1 : 0;
}

function checkNoCloudData() {
  const refs = grepFiles(/@upstash\/redis|@google-cloud\/storage|@aws-sdk\/client-s3|@aws-sdk\/s3-request-presigner|@sentry\/nextjs|sentry_flutter|UPSTASH_REDIS|SENTRY_DSN|GCS_BUCKET|S3_BUCKET|R2_BUCKET|\bNeon\b|Supabase|Railway|Google Cloud Storage|Cloudflare R2/i, {
    excludeFiles: new Set(['check-no-cloud-data.sh', 'static-gates.mjs', 'package-lock.json', 'tsconfig.tsbuildinfo']),
    excludeDirs: new Set(['docs', 'ephemeral']),
  });

  if (refs.length) {
    logFail(`cloud app-data/error-tracking references found:\n${refs.join('\n')}`);
    return 1;
  }
  logPass('no forbidden cloud data/error-tracking references found');
  return 0;
}

function checkLaptopService() {
  const state = { failed: false };
  for (const file of [
    'ecosystem.config.js',
    'scripts/laptop-service.ps1',
    'scripts/laptop-service-smoke.ps1',
    'docs/LAPTOP_SERVICE_ARCHITECTURE.md',
    'docs/LAPTOP_SERVICE_RUNBOOK.md',
    'web/src/app/api/health/route.ts',
    'web/src/app/api/health/db/route.ts',
    'web/src/app/api/health/storage/route.ts',
    'web/src/app/api/health/worker/route.ts',
  ]) {
    requireFile(file, state);
  }

  const ecosystem = path.join(ROOT, 'ecosystem.config.js');
  const ecosystemText = existsSync(ecosystem) ? readdirSafeText(ecosystem) : '';
  if (/interpreter:\s*['"]bash['"]|script:\s*['"]bash['"]/.test(ecosystemText)) {
    logFail('ecosystem.config.js contains bash-specific PM2 interpreter/script');
    state.failed = true;
  } else {
    logPass('PM2 config is not bash-only');
  }

  const docsText = ['ecosystem.config.js', 'docs/LAPTOP_SERVICE_ARCHITECTURE.md', 'docs/LAPTOP_SERVICE_RUNBOOK.md']
    .map((file) => {
      const full = path.join(ROOT, file);
      return existsSync(full) ? readdirSafeText(full) : '';
    })
    .join('\n');
  if (/DATA_MODE=local_laptop|DATA_MODE:\s*['"]local_laptop['"]/.test(docsText)) {
    logPass('local_laptop mode is documented/enforced in service layer');
  } else {
    logFail('local_laptop mode not found in service layer docs/config');
    state.failed = true;
  }

  const archDoc = path.join(ROOT, 'docs/LAPTOP_SERVICE_ARCHITECTURE.md');
  const archText = existsSync(archDoc) ? readdirSafeText(archDoc) : '';
  if (/pm2/i.test(archText) && /PostgreSQL|localhost:5432/.test(archText) && /LOCAL_STORAGE_ROOT/.test(archText) && /BACKUP_ROOT/.test(archText)) {
    logPass('laptop service doc covers PM2, PostgreSQL, storage, and backups');
  } else {
    logFail('laptop service doc is incomplete');
    state.failed = true;
  }

  return state.failed ? 1 : 0;
}

function checkPublicBeta() {
  const state = { failed: false };
  console.log(`Checking Voltium public beta readiness in: ${ROOT} (flutter-only: ${Number(flutterOnly)})`);

  for (const [name, code] of [
    ['no-docker', checkNoDocker()],
    ['no-cloud-data', checkNoCloudData()],
    ['laptop-service', checkLaptopService()],
  ]) {
    if (code !== 0) {
      logFail(`${name} sub-gate failed`);
      state.failed = true;
    }
  }

  const envFiles = [];
  walk(ROOT, (file) => {
    const name = path.basename(file);
    if (['.env', '.env.local', '.env.production', '.env.production.local'].includes(name) && !isGitIgnored(file)) {
      envFiles.push(rel(file));
    }
  });
  if (envFiles.length) {
    logFail(`tracked or unignored env files found: ${envFiles.join(', ')}`);
    state.failed = true;
  } else {
    logPass('no tracked source-package env files found');
  }

  for (const file of [
    'web/src/app/api/admin/data-management/backups/route.ts',
    'web/src/app/api/admin/data-management/backups/[id]/route.ts',
    'web/src/app/api/admin/data-management/backups/[id]/verify/route.ts',
    'web/src/app/api/admin/data-management/backups/[id]/download/route.ts',
    'web/src/app/api/admin/data-management/restore/validate/route.ts',
    'web/src/app/api/admin/data-management/restore/start/route.ts',
    'web/src/app/api/admin/data-management/schedule/route.ts',
    'docs/PUBLIC_BETA_READINESS.md',
    'docs/PUBLIC_BETA_RUNBOOK.md',
    'docs/PUBLIC_BETA_TEST_PLAN.md',
    'docs/LAPTOP_SERVICE_ARCHITECTURE.md',
    'docs/DATA_MANAGEMENT.md',
    'web/src/app/api/files/local-upload/[fileRecordId]/route.ts',
    'web/src/app/api/admin/maintenance-mode/route.ts',
    'web/src/app/api/health/db/route.ts',
    'web/src/app/api/health/storage/route.ts',
    'web/src/app/api/health/worker/route.ts',
  ]) {
    requireFile(file, state);
  }

  const artifactDirs = [];
  for (const dir of ['playwright-report', 'test-results', 'flutter/screenshots', 'data/uploads', 'data/backups']) {
    const full = path.join(ROOT, dir);
    if (existsSync(full) && !isGitIgnored(full)) artifactDirs.push(dir);
  }
  if (artifactDirs.length) {
    logFail(`tracked or unignored debug/test/data artifacts found: ${artifactDirs.join(', ')}`);
    state.failed = true;
  } else {
    logPass('no tracked beta-blocking artifacts found');
  }

  const dbPushRefs = flutterOnly ? [] : grepFiles(/prisma db push|"db:push"/, {
    excludeFiles: new Set(['static-gates.mjs']),
    excludeDirs: new Set(['node_modules', '.git', '.next']),
  }).filter((line) => line.startsWith('web/package.json') || line.startsWith('.github/'));
  if (dbPushRefs.length) {
    logFail(`prisma db push production/CI references found:\n${dbPushRefs.join('\n')}`);
    state.failed = true;
  } else {
    logPass(flutterOnly ? 'skipping db push check for --flutter-only' : 'no prisma db push production/CI path found');
  }

  if (state.failed) {
    console.error('\nFAIL: static public beta readiness gate failed.');
    return 1;
  }
  console.log('\nPASS: static public beta readiness gate passed.');
  return 0;
}

const gates = {
  'no-docker': checkNoDocker,
  'no-cloud-data': checkNoCloudData,
  'laptop-service': checkLaptopService,
  'public-beta': checkPublicBeta,
};

if (!gates[gate]) {
  console.error(`Unknown static gate: ${gate}`);
  process.exit(2);
}

process.exitCode = gates[gate]();
