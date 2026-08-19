import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { validateBody, createTeamLeaderSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { teamLeaderUseCases } from '@/server/modules/team-leaders/team-leader.use-cases';
import { parsePositiveInt } from '@/lib/api-utils';

const deleteTeamLeaderSchema = z.object({
  id: z.string().min(1),
});

// P2-3 (2026-08-05 ops audit): the PUT schema was built inline as
// `createTeamLeaderSchema.partial().extend(...)` — correct but hard to read.
// Named once here; the empty-update check in the handler still inspects the
// RAW body keys (the partial schema applies `.default(true)` to isActive).
const updateTeamLeaderSchema = createTeamLeaderSchema.partial().extend({
  id: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // PR-1 (2026-08-06 fix plan): canonical key — `tl_manage` is a legacy alias.
  // Accept both so admins with stored legacy permissions aren't locked out.
  const canManage =
    hasPermission(session.adminRole || '', 'team_leaders_manage') ||
    hasPermission(session.adminRole || '', 'tl_manage');
  if (!canManage) return adminForbidden();

  try {
    const { searchParams } = req.nextUrl;
    const page = parsePositiveInt(searchParams.get('page'), 1);
    const limit = parsePositiveInt(searchParams.get('limit'), 20, 100);
    const search = searchParams.get('search');
    const hubId = searchParams.get('hubId');
    const isActiveRaw = searchParams.get('isActive');
    const isActive = z.enum(['ACTIVE', 'INACTIVE']).optional().catch(undefined).parse(isActiveRaw || undefined);

    const result = await teamLeaderUseCases.list({ search, isActive, hubId, page, limit });
    return withCacheHeaders(success(result), 10);
  } catch (error) {
    logger.error('GET /api/admin/team-leaders error:', error);
    return errors.internal('Failed to fetch team leaders');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // PR-1 (2026-08-06 fix plan): canonical key — `tl_manage` is a legacy alias.
  // Accept both so admins with stored legacy permissions aren't locked out.
  const canManage =
    hasPermission(session.adminRole || '', 'team_leaders_manage') ||
    hasPermission(session.adminRole || '', 'tl_manage');
  if (!canManage) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(createTeamLeaderSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const teamLeader = await teamLeaderUseCases.create(validation.data, session.adminId || '');
    return success(teamLeader, 'Team leader created', 201);
  } catch (error) {
    logger.error('POST /api/admin/team-leaders error:', error);
    return errors.internal('Failed to create team leader');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // PR-1 (2026-08-06 fix plan): canonical key — `tl_manage` is a legacy alias.
  // Accept both so admins with stored legacy permissions aren't locked out.
  const canManage =
    hasPermission(session.adminRole || '', 'team_leaders_manage') ||
    hasPermission(session.adminRole || '', 'tl_manage');
  if (!canManage) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(updateTeamLeaderSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { id, ...data } = validation.data;
    // P0-6 (2026-08-05 ops audit): `{id}` alone passed the partial schema and
    // hit the repository as a no-op update that still wrote an audit entry —
    // admin spam polluted the trail with "team leader updated" rows that
    // changed nothing. Reject empty updates up front.
    //
    // NOTE: we inspect the RAW body keys, not the parsed `data` — the schema
    // applies `.default(true)` to isActive, so `{id}` parses to a non-empty
    // object. Only fields the client actually sent count as an update.
    const updatableKeys = Object.keys(data);
    const sentKeys = Object.keys(body as Record<string, unknown>).filter(
      (k) => k !== 'id' && updatableKeys.includes(k)
    );
    if (sentKeys.length === 0) {
      return errors.badRequest('No fields to update');
    }
    const teamLeader = await teamLeaderUseCases.update(id, data, session.adminId || '');
    return success(teamLeader);
  } catch (error) {
    logger.error('PUT /api/admin/team-leaders error:', error);
    return errors.internal('Failed to update team leader');
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // PR-1 (2026-08-06 fix plan): canonical key — `tl_manage` is a legacy alias.
  // Accept both so admins with stored legacy permissions aren't locked out.
  const canManage =
    hasPermission(session.adminRole || '', 'team_leaders_manage') ||
    hasPermission(session.adminRole || '', 'tl_manage');
  if (!canManage) return adminForbidden();

  try {
    // P1-3/P3-3: the audit flagged body-id DELETE as inconsistent with a
    // hypothetical /[id] convention — but hubs/faqs/offers/shifts all take
    // {id} from the body in this codebase (single-collection routes; the
    // dynamic [id] routes are reserved for nested resources). Keeping the
    // body convention avoids a parallel API surface; documented here so it
    // reads as a deliberate choice, not an accident.
    const body = await req.json();
    const validation = validateBody(deleteTeamLeaderSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    await teamLeaderUseCases.delete(validation.data.id, session.adminId || '');
    return success(null, 'Team leader deleted');
  } catch (error) {
    logger.error('DELETE /api/admin/team-leaders error:', error);
    return errors.internal('Failed to delete team leader');
  }
}
