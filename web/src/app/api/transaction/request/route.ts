// Legacy alias for backward compatibility. The canonical URL is
// /api/transaction/topup. This /api/transaction/request alias is
// kept for older Flutter clients that have not migrated. Do NOT
// remove without a deprecation cycle and a Flutter app release.
import { POST as topupPOST } from '../topup/route';

export const POST = topupPOST;

