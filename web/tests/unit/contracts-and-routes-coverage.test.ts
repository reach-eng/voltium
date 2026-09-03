import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const CONTRACTS_OPENAPI_JSON = resolve(__dirname, '../../src/contracts/openapi.json');
const APP_API_DIR = resolve(__dirname, '../../src/app/api');

describe('OpenAPI & API Route Contracts Alignment', () => {
  const spec = JSON.parse(readFileSync(CONTRACTS_OPENAPI_JSON, 'utf-8'));
  const paths = Object.keys(spec.paths);

  it('every OpenAPI path maps to an existing API route directory and file', () => {
    for (const apiPath of paths) {
      // Normalize dynamic params: /api/files/{path} -> /api/files/[...path] or [path]
      let relPath = apiPath.replace(/^\/api\//, '');
      const segments = relPath.split('/').map((seg) => {
        if (seg.startsWith('{') && seg.endsWith('}')) {
          const param = seg.slice(1, -1);
          // Try standard param or catch-all
          return param;
        }
        return seg;
      });

      // Check if standard dir exists or dynamic directory exists
      let currentDir = APP_API_DIR;
      let matched = true;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const normalPath = join(currentDir, seg);
        const dynamicPath = join(currentDir, `[${seg}]`);
        const catchAllPath = join(currentDir, `[...${seg}]`);

        if (existsSync(normalPath)) {
          currentDir = normalPath;
        } else if (existsSync(dynamicPath)) {
          currentDir = dynamicPath;
        } else if (existsSync(catchAllPath)) {
          currentDir = catchAllPath;
        } else {
          matched = false;
          break;
        }
      }

      const routeFile = join(currentDir, 'route.ts');
      expect(
        matched && existsSync(routeFile),
        `OpenAPI path ${apiPath} must resolve to a valid route.ts file (resolved: ${routeFile})`
      ).toBe(true);
    }
  });

  it('POST /api/admin/deposits is implemented and exported in route.ts', async () => {
    const routeSource = readFileSync(
      resolve(APP_API_DIR, 'admin/deposits/route.ts'),
      'utf-8'
    );
    expect(routeSource).toContain('export const POST');
  });

  it('POST /api/admin/transactions is implemented and exported in route.ts', async () => {
    const routeSource = readFileSync(
      resolve(APP_API_DIR, 'admin/transactions/route.ts'),
      'utf-8'
    );
    expect(routeSource).toContain('export const POST');
  });

  it('all OpenAPI operations declare valid HTTP methods and response schemas', () => {
    let operationCount = 0;
    const validMethods = ['get', 'post', 'put', 'delete', 'patch'];

    for (const [pathKey, pathObj] of Object.entries(spec.paths as Record<string, any>)) {
      for (const [method, op] of Object.entries(pathObj as Record<string, any>)) {
        if (!validMethods.includes(method)) continue;
        operationCount++;
        expect(op).toBeDefined();
        expect(typeof op.summary).toBe('string');
        expect(op.responses).toBeDefined();
        expect(Object.keys(op.responses).length).toBeGreaterThan(0);
      }
    }

    expect(operationCount).toBeGreaterThanOrEqual(100);
  });
});
