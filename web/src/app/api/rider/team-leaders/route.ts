/**
 * GET /api/rider/team-leaders?hubId=<id> — list active team leaders for a hub.
 *
 * PR-ONBOARDING-2026-08-11 (audit 2.5): the Flutter pickup screen used to ship
 * a hardcoded 3-entry team leader list (Rajesh, Sanjay, Not assigned). Adding
 * a new TL required a code change. This endpoint lets the rider client fetch
 * the live list scoped to the selected hub. Returns id + name + phone; no
 * PII (the rider already has the TL's contact from this response).
 *
 * No admin auth: the rider sees the same TLs they would see at the hub
 * counter, scoped to active rows.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;

    const { searchParams } = new URL(request.url);
    const hubId = searchParams.get('hubId');

    const teamLeaders = await db.teamLeader.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(hubId ? { OR: [{ hubId }, { hubId: null }] } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        hubId: true,
      },
      orderBy: { name: 'asc' },
    });

    return success(teamLeaders);
  } catch (err) {
    logger.error('[GET /api/rider/team-leaders]', err);
    return errors.internal('Failed to fetch team leaders');
  }
}
