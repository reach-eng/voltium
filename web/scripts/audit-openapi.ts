/**
 * OpenAPI coverage audit (Phase 2.1).
 *
 * Walks every route.ts file under src/app/api/, extracts the
 * exported HTTP methods (GET, POST, PUT, DELETE, PATCH), and
 * compares them against the entries in src/contracts/openapi.ts
 * and src/contracts/openapi.json.
 *
 * Emits a CSV report at docs/audits/openapi-coverage-DATE.csv and
 * exits with code 1 if coverage is below 100 percent.
 *
 * Run via:  npx tsx scripts/audit-openapi.ts
 * Or via:   npm run audit:openapi
 *
 * The script is intentionally regex-based so it does not require
 * the TypeScript compiler to be wired into the script runner.
 * The extractor for openapi.ts is a small state machine that walks
 * brace depth; the route-file extractor is a simple grep of the
 * method names.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT, 'src', 'app', 'api');
const OPENAPI_TS = path.join(ROOT, 'src', 'contracts', 'openapi.ts');
const OPENAPI_JSON = path.join(ROOT, 'src', 'contracts', 'openapi.json');
const AUDITS_DIR = path.join(ROOT, '..', 'docs', 'audits');

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
type Method = (typeof METHODS)[number];

interface RouteEntry {
  method: Method;
  path: string; // Next.js style, e.g. /api/riders/[id]
  file: string; // absolute path
}

interface OpenApiEntry {
  method: Method;
  path: string; // OpenAPI style, e.g. /api/riders/{id}
}

interface DiffRow {
  status: 'present' | 'missing_route' | 'missing_openapi' | 'method_mismatch';
  method: Method;
  nextPath: string;
  openapiPath: string;
  file: string;
}

// ---------------------------------------------------------------------------
// 1. Extract routes from route.ts files
// ---------------------------------------------------------------------------

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
  // /src/app/api/admin/riders/[id]/route.ts  ->  /api/admin/riders/[id]
  const rel = path.relative(API_DIR, file); // admin/riders/[id]/route.ts
  const noRouteTs = rel.replace(/[\\/]+route\.ts$/, '');
  const segments = noRouteTs.split(/[\\/]+/).filter(Boolean);
  return '/api/' + segments.join('/');
}

function extractRouteEntries(file: string): Method[] {
  const src = fs.readFileSync(file, 'utf8');
  // Find every `export async function XXX(` declaration at the top level
  // (no nested function bodies).
  const re = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\b/g;
  const found = new Set<Method>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    found.add(m[1] as Method);
  }
  // Sort to keep the output stable
  return METHODS.filter((m) => found.has(m));
}

function collectRoutes(): RouteEntry[] {
  const files = listRouteFiles(API_DIR);
  const out: RouteEntry[] = [];
  for (const f of files) {
    const apiPath = fileToApiPath(f);
    for (const m of extractRouteEntries(f)) {
      out.push({ method: m, path: apiPath, file: f });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Extract OpenAPI entries from openapi.ts (state machine) + openapi.json
// ---------------------------------------------------------------------------

function nextPathToOpenApi(nextPath: string): string {
  // /api/riders/[id] -> /api/riders/{id}
  // /api/files/[...path] -> /api/files/{path} (Next-style catch-all)
  // (OpenAPI does not differentiate single vs catch-all; the operator
  // can rename the placeholder when writing the spec.)
  return nextPath.replace(/\[\.\.\.([^\]]+)\]/g, '{$1}').replace(
    /\[([^\]]+)\]/g,
    '{$1}'
  );
}

function extractOpenApiFromTs(): OpenApiEntry[] {
  const src = fs.readFileSync(OPENAPI_TS, 'utf8');
  const out: OpenApiEntry[] = [];
  // Find each `'/api/...': {` block, then collect the method keys
  // within the matching braces (top-level keys of the object).
  const pathRe = /'([^']+)':\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(src)) !== null) {
    const startIdx = m.index;
    const pathStart = m.index + m[0].length; // position after the `{`
    const pathName = m[1];
    if (!pathName.startsWith('/api/')) continue;

    // Walk braces to find the matching `}`.
    let depth = 1;
    let i = pathStart;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    const block = src.slice(pathStart, i - 1);

    // Within the block, find method keys at the start of a line. A
    // simple regex that allows leading whitespace and a colon.
    const methodRe = /^\s*(get|post|put|delete|patch)\s*:/gm;
    let mm: RegExpExecArray | null;
    while ((mm = methodRe.exec(block)) !== null) {
      out.push({ method: mm[1].toUpperCase() as Method, path: pathName });
    }
  }
  return out;
}

function extractOpenApiFromJson(): OpenApiEntry[] {
  if (!fs.existsSync(OPENAPI_JSON)) return [];
  const json = JSON.parse(fs.readFileSync(OPENAPI_JSON, 'utf8'));
  const paths = json.paths ?? {};
  const out: OpenApiEntry[] = [];
  for (const [pathName, ops] of Object.entries(paths)) {
    if (typeof ops !== 'object' || ops === null) continue;
    for (const m of Object.keys(ops)) {
      const up = m.toUpperCase();
      if ((METHODS as readonly string[]).includes(up)) {
        out.push({ method: up as Method, path: pathName });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Diff
// ---------------------------------------------------------------------------

function diff(
  routes: RouteEntry[],
  openapi: OpenApiEntry[]
): DiffRow[] {
  const out: DiffRow[] = [];
  const openapiKeys = new Set(
    openapi.map((o) => `${o.method}\t${o.path}`)
  );
  const seen = new Set<string>();

  // 1. Every route.ts entry should be in OpenAPI.
  for (const r of routes) {
    const oPath = nextPathToOpenApi(r.path);
    const key = `${r.method}\t${oPath}`;
    seen.add(key);
    if (openapiKeys.has(key)) {
      out.push({
        status: 'present',
        method: r.method,
        nextPath: r.path,
        openapiPath: oPath,
        file: r.file,
      });
    } else {
      out.push({
        status: 'missing_openapi',
        method: r.method,
        nextPath: r.path,
        openapiPath: oPath,
        file: r.file,
      });
    }
  }

  // 2. OpenAPI entries without a corresponding route.ts file.
  for (const o of openapi) {
    if (seen.has(`${o.method}\t${o.path}`)) continue;
    out.push({
      status: 'missing_route',
      method: o.method,
      nextPath: '',
      openapiPath: o.path,
      file: '',
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. Render
// ---------------------------------------------------------------------------

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function renderCsv(rows: DiffRow[]): string {
  const header = ['status', 'method', 'next_path', 'openapi_path', 'file'];
  const lines: string[] = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.status,
        r.method,
        r.nextPath,
        r.openapiPath,
        r.file,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  return lines.join('\n');
}

function renderSummary(rows: DiffRow[]): string {
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const present = byStatus['present'] ?? 0;
  const total = rows.length;
  const coverage = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';
  return [
    'OpenAPI coverage audit (Phase 2.1):',
    `  present (route.ts + openapi):      ${present}`,
    `  missing_openapi (route without spec): ${byStatus['missing_openapi'] ?? 0}`,
    `  missing_route (spec without route):   ${byStatus['missing_route'] ?? 0}`,
    `  total entries:                    ${total}`,
    `  coverage:                         ${coverage}%`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 5. Main
// ---------------------------------------------------------------------------

function main(): void {
  const routes = collectRoutes();
  const fromTs = extractOpenApiFromTs();
  const fromJson = extractOpenApiFromJson();

  // Prefer the JSON (compiled) if present, fall back to the TS source.
  const openapi = fromJson.length > 0 ? fromJson : fromTs;

  const rows = diff(routes, openapi);
  const summary = renderSummary(rows);

  console.log(summary);

  if (!fs.existsSync(AUDITS_DIR)) {
    fs.mkdirSync(AUDITS_DIR, { recursive: true });
  }
  const today = new Date().toISOString().split('T')[0];
  const csvPath = path.join(AUDITS_DIR, `openapi-coverage-${today}.csv`);
  fs.writeFileSync(csvPath, renderCsv(rows));
  console.log(`\nCSV report written to ${csvPath}`);

  // Exit non-zero if there are missing-openapi entries.
  const missing = rows.filter((r) => r.status === 'missing_openapi').length;
  if (missing > 0) {
    console.log(
      `\n${missing} routes are missing from openapi.ts. See Phase 2.2.`
    );
    process.exitCode = 1;
  }
}

main();
