// Debug unmatched calls
import fs from 'node:fs';
import path from 'node:path';

const webRoot = 'D:/voltium/web/src/app/api';
const flutterRoot = 'D:/voltium/flutter/lib';

const webPaths = new Map();
function walkWeb(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walkWeb(p);
    else if (e.name === 'route.ts') {
      const c = fs.readFileSync(p, 'utf8');
      const verbs = [];
      for (const v of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
        if (new RegExp('export (async )?function ' + v + '\\b').test(c)) verbs.push(v);
        if (new RegExp('export const ' + v + '\\s*=').test(c)) verbs.push(v);
      }
      const rel = p.replace(/^.*[\\/]app[\\/]api[\\/]/, '').replace(/[\\/]route\.ts$/, '').replace(/\\/g, '/');
      for (const v of verbs) {
        const key = v + ' /api/' + rel;
        webPaths.set(key, p);
      }
    }
  }
}
walkWeb(webRoot);

const flutterCalls = [];
function walkFlutter(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walkFlutter(p);
    else if (e.name.endsWith('.dart')) {
      const c = fs.readFileSync(p, 'utf8');
      const re = /_client\.(get|post|put|patch|delete|getWithSWR)\(\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(c)) !== null) {
        const verb = m[1].toUpperCase() === 'GETWITHSWR' ? 'GET' : m[1].toUpperCase();
        flutterCalls.push({ verb, path: m[2], site: p.replace(/^.*[\\/]lib[\\/]/, 'lib/') });
      }
    }
  }
}
walkFlutter(flutterRoot);

function templateToRegex(t) {
  // Convert both {param} and $param into [^/]+
  return new RegExp('^' + t.replace(/[{}]/g, '').replace(/\$[A-Za-z_]\w*/g, '([^/]+)').replace(/\[([^\]]+)\]/g, '(.+?)') + '$');
}

console.log('TOTAL WEB METHODS:', webPaths.size);
console.log('TOTAL FLUTTER CALLS:', flutterCalls.length);

const unmatched = [];
for (const c of flutterCalls) {
  let match = null;
  for (const wkey of webPaths.keys()) {
    if (!wkey.startsWith(c.verb + ' ')) continue;
    const wpath = wkey.slice(c.verb.length + 1);
    if (templateToRegex(wpath).test(c.path)) {
      match = wkey;
      break;
    }
  }
  if (!match) unmatched.push(c);
}

console.log('\nUNMATCHED:', unmatched.length);
for (const u of unmatched) console.log('  ', u.verb, u.path, '←', u.site);
