// More precise: for each route path, check if any integration test file
// actually hits that path (not just the top-level keyword).
import fs from 'node:fs';
import path from 'node:path';

const routesRoot = 'D:/voltium/web/src/app/api';
const testsRoot = 'D:/voltium/web/tests/integration';
const unitApiRoot = 'D:/voltium/web/tests/unit/api';

const testFiles = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.test.ts')) testFiles.push(p);
  }
}
walk(testsRoot);
walk(unitApiRoot);
const allTests = testFiles.map((f) => ({ path: f, content: fs.readFileSync(f, 'utf8') }));

const routeFiles = [];
function walkRoutes(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walkRoutes(p);
    else if (e.name === 'route.ts') routeFiles.push(p);
  }
}
walkRoutes(routesRoot);

const results = [];
for (const f of routeFiles) {
  const rel = f.replace(/^.*[\\/]app[\\/]api[\\/]/, '').replace(/[\\/]route\.ts$/, '').replace(/\\/g, '/');
  const apiPath = '/api/' + rel;
  // Check if any test file imports the route module or has the api path
  const hits = allTests.filter((t) => {
    // Look for explicit path string `/api/...` or import of the route file
    return t.content.includes(`'${apiPath}'`) ||
           t.content.includes(`"${apiPath}"`) ||
           t.content.includes(apiPath + '/') ||
           // Match parent path (e.g. /api/rider/kyc is covered by a test that calls /api/rider/kyc/sub-thing)
           new RegExp(`['"\`]${apiPath}(/[^'"\`]*)?['"\`]`).test(t.content);
  });
  results.push({ path: apiPath, testCount: hits.length });
}

const untested = results.filter((r) => r.testCount === 0);
console.log('TOTAL ROUTES:', results.length);
console.log('ROUTES NOT REFERENCED IN ANY TEST:', untested.length);
console.log('---');
for (const r of untested) console.log('  ', r.path);
