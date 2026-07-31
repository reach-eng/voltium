import { beforeAll } from 'vitest';

const BASE = 'http://localhost:8081';
export let adminCookie: string | null = null;

export async function initAdminAuth() {
  if (adminCookie) return;
  try {
    const res = await fetch(`${BASE}/api/admin/auth/auto-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      adminCookie = setCookie;
    }
  } catch (err) {
    console.error('Failed to log in as admin for API tests', err);
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

  if (adminCookie && path.startsWith('/api/admin')) {
    headers['Cookie'] = adminCookie;
  }

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}
