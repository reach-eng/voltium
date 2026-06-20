import { describe, it, expect } from 'vitest';
import { PERMISSIONS, hasPermission } from '@/lib/auth';
import * as fs from 'fs';
import * as path from 'path';

const ROUTES_DIR = path.join(__dirname, '../../src/app/api');

describe('permission map integrity', () => {
  it('every hasPermission call references a defined permission', () => {
    const calls: string[] = [];
    function walk(dir: string) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (p.endsWith('route.ts')) {
          const src = fs.readFileSync(p, 'utf8');
          const re = /hasPermission\([^,]+,\s*['"]([a-z_]+)['"]\)/g;
          let m;
          while ((m = re.exec(src))) calls.push(m[1]);
        }
      }
    }
    walk(ROUTES_DIR);
    expect(calls.length).toBeGreaterThan(10); // sanity
    for (const c of calls) {
      expect(c in PERMISSIONS, `undefined permission: ${c}`).toBe(true);
    }
  });

  it('SUPER_ADMIN can exercise incidents_manage (regression for C1)', () => {
    expect(hasPermission({ adminRole: 'SUPER_ADMIN' } as any, 'incidents_manage')).toBe(true);
  });
});
