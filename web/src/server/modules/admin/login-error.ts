/**
 * Typed login failure (P0-7, 2026-08-05 admin auth audit).
 *
 * The admin login route previously matched on fragile error-message strings
 * ('Invalid credentials', 'Too many login attempts...') thrown by the
 * use-cases layer. A typo or reworded message silently changed the HTTP
 * status. LoginError carries an explicit machine-readable code so the route
 * can map failures to 401/403 without string matching.
 */

export type LoginErrorCode = 'INVALID_CREDENTIALS' | 'ACCOUNT_DEACTIVATED';

export class LoginError extends Error {
  constructor(
    message: string,
    public readonly code: LoginErrorCode
  ) {
    super(message);
    this.name = 'LoginError';
  }
}
