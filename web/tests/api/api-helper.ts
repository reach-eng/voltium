import { beforeAll } from 'vitest';
import { adminLoginTo } from '../admin-auth-helper';

const BASE = 'http://localhost:8081';
export let adminCookie: string | null = null;

export async function initAdminAuth() {
  if (adminCookie) return;
  // P0-2: auto-login route is deleted — authenticate with real credentials.
  // Fail hard if admin login fails so tests cannot go green-vacuous.
  adminCookie = await adminLoginTo(BASE);
  if (!adminCookie) {
    throw new Error('initAdminAuth: adminLoginTo succeeded but returned empty adminCookie');
  }
}

export async function api(
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any),
  };

  if (path.startsWith('/api/admin')) {
    if (!adminCookie) {
      throw new Error(`Cannot request ${path} without adminCookie: admin authentication is required.`);
    }
    headers['Cookie'] = adminCookie;
  }

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}
