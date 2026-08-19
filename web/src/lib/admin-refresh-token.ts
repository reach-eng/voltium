/**
 * P1-13: in-memory store for the admin refresh token used by the client-side
 * refresh interceptor (shared by AdminLayout and AdminLoginForm).
 *
 * Deliberately NOT persisted (no localStorage/sessionStorage): a page reload
 * falls back to the session cookie (worst case: re-login), and nothing can
 * be exfiltrated from persistent web storage. Browser-safe — no server
 * imports.
 */
let adminRefreshToken: string | null = null;

export function getAdminRefreshToken(): string | null {
  return adminRefreshToken;
}

export function setAdminRefreshToken(token: string): void {
  adminRefreshToken = token;
}

export function clearAdminRefreshToken(): void {
  adminRefreshToken = null;
}
