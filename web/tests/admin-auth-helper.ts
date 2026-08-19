/**
 * Shared admin login helper for integration/API tests (P0-2).
 *
 * The `/api/admin/auth/auto-login` backdoor was deleted, so every test now
 * logs in through `/api/admin/auth/login` exactly like a real admin.
 * Credentials are resolved from the same env vars the seeders use:
 *
 *   - CI:    `npm run db:seed`            → admin@voltium.in  + SEED_ADMIN_PASSWORD
 *   - Local: `npm run db:seed-dev-admin`  → admin@voltium.io + ADMIN_PASSWORD
 *
 * TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD override both.
 */

export function resolveAdminCredentials(): Array<{ email: string; password: string }> {
  const explicitEmail = process.env.TEST_ADMIN_EMAIL;
  const explicitPassword = process.env.TEST_ADMIN_PASSWORD;
  if (explicitEmail && explicitPassword) {
    return [{ email: explicitEmail, password: explicitPassword }];
  }

  const candidates: Array<{ email: string; password: string }> = [];
  const seedPassword = process.env.SEED_ADMIN_PASSWORD || '';
  const devPassword = process.env.ADMIN_PASSWORD || '';
  if (seedPassword) candidates.push({ email: 'admin@voltium.in', password: seedPassword });
  if (devPassword) candidates.push({ email: 'admin@voltium.io', password: devPassword });
  return candidates;
}

export async function adminLoginTo(baseUrl: string): Promise<string> {
  const candidates = resolveAdminCredentials();
  for (const { email, password } of candidates) {
    const res = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.status === 200) {
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) return setCookie.split(';')[0];
    }
  }
  throw new Error(
    'adminLoginTo failed — could not authenticate via /api/admin/auth/login. ' +
      'Set TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD, or ADMIN_PASSWORD (admin@voltium.io) ' +
      '/ SEED_ADMIN_PASSWORD (admin@voltium.in) so the test can log in with real credentials.'
  );
}
