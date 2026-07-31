// Legacy alias for backward compatibility. The canonical URL is
// /api/rider/device/verify-lock (matches the resource hierarchy).
// This flat alias (/api/rider/verify-lock-password) is kept for
// older Flutter clients that have not migrated. Do NOT remove
// without a deprecation cycle and a Flutter app release.
export { POST } from '../device/verify-lock/route';
