/**
 * Admin login form field defaults.
 *
 * P0-1 (2026-08-05 admin auth audit): the login form previously shipped
 * `admin@voltium.in` / `admin123` as useState defaults. Because AdminLayout
 * is server-rendered, those credentials were embedded in the HTML page
 * source served to any unauthenticated visitor of /admin.
 *
 * Credentials are now pre-filled ONLY in a development build (where the
 * NEXT_PUBLIC-visible dev admin exists). In every other environment
 * (production, staging, previews, tests) the fields start empty, so the
 * defaults can never leak into page source or browser autofill.
 *
 * Browser-safe: reads only process.env.NODE_ENV (inlined by Next.js).
 */

export interface AdminLoginDefaults {
  email: string;
  password: string;
}

export function getAdminLoginDefaults(): AdminLoginDefaults {
  const isDevBuild = process.env.NODE_ENV === 'development';
  return {
    email: isDevBuild ? 'admin@voltium.in' : '',
    password: isDevBuild ? 'admin123' : '',
  };
}
