/**
 * Shared error extraction helper.
 *
 * Reliably extracts a user-facing error message from API response JSON,
 * error payloads, or caught exceptions without resulting in `[object Object]`.
 */

export function extractErrorMessage(err: unknown, fallback = 'Operation failed'): string {
  if (!err) return fallback;
  if (typeof err === 'string') {
    const trimmed = err.trim();
    return trimmed || fallback;
  }
  if (err instanceof Error) {
    return err.message.trim() || fallback;
  }
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;

    // Check nested structured error: { error: { message: '...' } }
    if (obj.error && typeof obj.error === 'object') {
      const errObj = obj.error as Record<string, unknown>;
      if (typeof errObj.message === 'string' && errObj.message.trim()) {
        return errObj.message.trim();
      }
      if (typeof errObj.code === 'string' && errObj.code.trim()) {
        return errObj.code.trim();
      }
    }

    // Check string error: { error: '...' }
    if (typeof obj.error === 'string' && obj.error.trim()) {
      return obj.error.trim();
    }

    // Check top-level message: { message: '...' }
    if (typeof obj.message === 'string' && obj.message.trim()) {
      return obj.message.trim();
    }

    // Check details array from Zod or validation: { details: [...] }
    if (Array.isArray(obj.details) && obj.details.length > 0) {
      const first = obj.details[0];
      if (typeof first === 'string' && first.trim()) return first.trim();
      if (typeof first === 'object' && first !== null) {
        const detailObj = first as Record<string, unknown>;
        if (typeof detailObj.message === 'string' && detailObj.message.trim()) {
          return detailObj.message.trim();
        }
      }
    }
  }

  return fallback;
}
