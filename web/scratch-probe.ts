const BASE_URL = 'http://localhost:8081';

async function api(path: string, options: any = {}) {
  const headers = new Headers(options.headers);
  if (options.json) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.json);
  }
  if (options.cookie) {
    headers.set('Cookie', options.cookie);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let body = null;
  const text = await res.text();
  try {
    if (text) body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: res.status, body, headers: res.headers };
}

async function adminLogin() {
  const { status, body, headers } = await api('/api/admin/auth/auto-login', {
    method: 'POST',
    json: {},
  });
  if (status !== 200) {
    throw new Error(`Admin login failed: ${status}`);
  }
  const setCookie = headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('No set-cookie header');
  }
  return setCookie.split(';')[0];
}

async function run() {
  try {
    console.log('Logging in as admin...');
    const cookie = await adminLogin();
    console.log('Logged in. Cookie:', cookie);

    const endpoints = [
      { path: '/api/admin/data-management/overview', method: 'GET' },
      { path: '/api/admin/data-management/backups', method: 'GET' },
      { path: '/api/admin/data-management/backups', method: 'POST', json: { type: 'MANUAL' } },
      { path: '/api/admin/data-management/schedule', method: 'GET' },
      { path: '/api/admin/data-management/storage', method: 'GET' },
      { path: '/api/admin/data-management/restore/history', method: 'GET' },
    ];

    for (const ep of endpoints) {
      console.log(`\n--- Hitting ${ep.method} ${ep.path} ---`);
      const res = await api(ep.path, {
        method: ep.method,
        cookie,
        json: ep.json,
      });
      console.log('Status:', res.status);
      console.log('Body:', JSON.stringify(res.body, null, 2));
    }
  } catch (err: any) {
    console.error('Error running scratch script:', err);
  }
}

run();
