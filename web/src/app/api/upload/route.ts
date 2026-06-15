import { NextRequest } from 'next/server';
import { errors } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  return errors.gone('POST /api/upload is deprecated. Use POST /api/files/request-upload instead.');
}
