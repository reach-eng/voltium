/**
 * OpenAPI entry generator (Phase 2.2).
 *
 * For each route.ts file under src/app/api/, generate a minimal
 * OpenAPI entry (path + method + tag + summary + security) and
 * print it to stdout. The output can be pasted into openapi.ts.
 *
 * Run: npx tsx scripts/gen-openapi-entries.ts [route-dir]
 *   e.g. npx tsx scripts/gen-openapi-entries.ts src/app/api/admin/admins
 *
 * Without a directory argument, generates entries for ALL route.ts
 * files that are currently missing from openapi.ts.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT, 'src', 'app', 'api');
const OPENAPI_TS = path.join(ROOT, 'src', 'contracts', 'openapi.ts');

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
type Method = (typeof METHODS)[number];

function listRouteFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listRouteFiles(full));
    } else if (entry.isFile() && entry.name === 'route.ts') {
      out.push(full);
    }
  }
  return out;
}

function fileToApiPath(file: string): string {
  const rel = path.relative(API_DIR, file);
  const noRouteTs = rel.replace(/[\\/]+route\.ts$/, '');
  const segments = noRouteTs.split(/[\\/]+/).filter(Boolean);
  return '/api/' + segments.join('/');
}

function nextPathToOpenApi(p: string): string {
  return p.replace(/\[\.\.\.([^\]]+)\]/g, '{$1}').replace(/\[([^\]]+)\]/g, '{$1}');
}

function extractMethods(file: string): Method[] {
  const src = fs.readFileSync(file, 'utf8');
  const re = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\b/g;
  const found = new Set<Method>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    found.add(m[1] as Method);
  }
  return METHODS.filter((x) => found.has(x));
}

function readExistingOpenApiPaths(): Set<string> {
  const src = fs.readFileSync(OPENAPI_TS, 'utf8');
  const out = new Set<string>();
  const pathRe = /'([^']+)':\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(src)) !== null) {
    const pathName = m[1];
    if (!pathName.startsWith('/api/')) continue;
    const startIdx = m.index + m[0].length;
    let depth = 1;
    let i = startIdx;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    const block = src.slice(startIdx, i - 1);
    const methodRe = /^\s*(get|post|put|delete|patch)\s*:/gm;
    let mm: RegExpExecArray | null;
    while ((mm = methodRe.exec(block)) !== null) {
      out.add(`${mm[1].toUpperCase()}\t${pathName}`);
    }
  }
  return out;
}

function tagFor(apiPath: string): string {
  if (apiPath.startsWith('/api/admin')) return 'Admin';
  if (apiPath.startsWith('/api/rider')) return 'Rider Profile';
  if (apiPath.startsWith('/api/transaction') || apiPath.startsWith('/api/wallet')) return 'Wallet';
  if (apiPath.startsWith('/api/auth') || apiPath.startsWith('/api/riders/register-token')) return 'Auth';
  if (apiPath.startsWith('/api/files')) return 'Files';
  if (apiPath.startsWith('/api/support')) return 'Support';
  if (apiPath.startsWith('/api/notifications') || apiPath.startsWith('/api/notification')) return 'Notifications';
  if (apiPath.startsWith('/api/rental') || apiPath.startsWith('/api/shifts')) return 'Rentals';
  if (apiPath.startsWith('/api/vehicles')) return 'Vehicles';
  if (apiPath.startsWith('/api/hubs')) return 'Hubs';
  if (apiPath.startsWith('/api/pricing')) return 'Rentals';
  if (apiPath.startsWith('/api/health') || apiPath.startsWith('/api/internal') || apiPath.startsWith('/api/cron') || apiPath.startsWith('/api/monitoring') || apiPath.startsWith('/api/metrics') || apiPath.startsWith('/api/sync') || apiPath.startsWith('/api/search') || apiPath.startsWith('/api/device')) return 'Admin';
  if (apiPath.startsWith('/api/kyc') || apiPath.startsWith('/api/onboarding')) return 'KYC';
  return 'Admin';
}

function securityFor(apiPath: string): string | null {
  if (apiPath.startsWith('/api/admin') || apiPath.startsWith('/api/cron') || apiPath.startsWith('/api/internal') || apiPath.startsWith('/api/sync/queue') || apiPath.startsWith('/api/search')) {
    return 'adminSession';
  }
  if (apiPath.startsWith('/api/admin/riders/register-token')) return 'riderSession';
  if (apiPath.startsWith('/api/rider') || apiPath.startsWith('/api/riders/register-token') || apiPath.startsWith('/api/transaction') || apiPath.startsWith('/api/rental') || apiPath.startsWith('/api/support') || apiPath.startsWith('/api/notifications') || apiPath.startsWith('/api/notification') || apiPath.startsWith('/api/hubs') || apiPath.startsWith('/api/vehicles') || apiPath.startsWith('/api/files') || apiPath.startsWith('/api/pricing') || apiPath.startsWith('/api/device')) {
    return 'riderSession';
  }
  if (apiPath.startsWith('/api/auth')) return null; // public
  return 'adminSession';
}

function methodHasBody(m: Method): boolean {
  return m === 'POST' || m === 'PUT' || m === 'PATCH';
}

function humanize(s: string): string {
  return s
    .split(/[-_]/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function summaryFor(apiPath: string, method: Method): string {
  const segments = apiPath.replace(/^\/api\//, '').split('/');
  const tail = segments[segments.length - 1];
  const verb =
    method === 'GET'
      ? 'List'
      : method === 'POST'
      ? 'Create'
      : method === 'PUT'
      ? 'Update'
      : method === 'PATCH'
      ? 'Patch'
      : 'Delete';
  if (apiPath.includes('[id]') || /\{[^}]+\}$/.test(apiPath)) {
    if (method === 'GET') return `Get ${humanize(tail)}`;
    if (method === 'PUT') return `Update ${humanize(tail)}`;
    if (method === 'DELETE') return `Delete ${humanize(tail)}`;
    if (method === 'POST') return `Action on ${humanize(tail)}`;
    return `${verb} ${humanize(tail)}`;
  }
  if (method === 'GET') return `List ${humanize(tail)}`;
  if (method === 'POST') return `Create ${humanize(tail)}`;
  if (method === 'PUT') return `Bulk update ${humanize(tail)}`;
  if (method === 'DELETE') return `Delete ${humanize(tail)}`;
  return `${verb} ${humanize(tail)}`;
}

function renderEntry(apiPath: string, methods: Method[]): string {
  const tag = tagFor(apiPath);
  const sec = securityFor(apiPath);
  const methodEntries = methods.map((m) => {
    const lines: string[] = [];
    lines.push(`        ${m.toLowerCase()}: {`);
    lines.push(`          tags: ['${tag}'],`);
    lines.push(`          summary: '${summaryFor(apiPath, m)}',`);
    if (sec) {
      lines.push(`          security: [{ ${sec}: [] }],`);
    }
    if (methodHasBody(m)) {
      lines.push(
        `          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },`
      );
    }
    lines.push(`          responses: { '200': { description: 'OK' } },`);
    lines.push(`        },`);
    return lines.join('\n');
  });

  return [
    `      '${apiPath}': {`,
    ...methodEntries,
    `      },`,
  ].join('\n');
}

function main(): void {
  const arg = process.argv[2];
  const target = arg ? path.resolve(ROOT, arg) : API_DIR;
  if (!fs.existsSync(target)) {
    console.error(`Target not found: ${target}`);
    process.exit(1);
  }
  const files = listRouteFiles(target);
  const existing = readExistingOpenApiPaths();

  for (const f of files) {
    const apiPath = fileToApiPath(f);
    const openapiPath = nextPathToOpenApi(apiPath);
    const methods = extractMethods(f);
    const present = methods.filter((m) => existing.has(`${m}\t${openapiPath}`));
    const missing = methods.filter((m) => !existing.has(`${m}\t${openapiPath}`));
    if (missing.length === 0) continue;
    console.log(`-- ${apiPath} (${openapiPath}) --`);
    console.log(renderEntry(openapiPath, missing));
    console.log('');
  }
}

main();
