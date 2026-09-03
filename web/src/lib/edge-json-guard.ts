/**
 * Edge-safe parse-only JSON guard. P1 split from `src/middleware.ts`.
 *
 * Full Zod validation runs per-route in the Node runtime via validateBody()
 * (see lib/validators.ts). Keeping schema validation out of the Edge bundle
 * avoids pulling pino/Prisma transitively.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const GUARDED_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/** Returns a 400 envelope when the JSON body is unparseable, else null. */
export async function guardEdgeJsonBody(request: NextRequest): Promise<NextResponse | null> {
  if (!request.nextUrl.pathname.startsWith('/api/')) return null;
  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) return null;
  if (!GUARDED_METHODS.has(request.method)) return null;
  if (request.headers.get('content-length') === '0') return null;
  try {
    await request.clone().json();
    return null;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' },
      },
      { status: 400 }
    );
  }
}
