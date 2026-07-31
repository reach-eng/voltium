import { errors } from '@/lib/api-response';

/**
 * Deprecated legacy upload endpoint.
 *
 * Architecture 10/10 rule: production uploads must use the FileRecord-backed
 * local upload flow:
 *   POST /api/files/request-upload
 *   PUT  /api/files/local-upload/[fileRecordId]?token=...
 *   POST /api/files/confirm-upload
 *
 * This route is intentionally disabled to prevent anonymous key-based writes.
 */
export async function PUT() {
  return errors.gone('Deprecated upload endpoint disabled. Use /api/files/request-upload.');
}
