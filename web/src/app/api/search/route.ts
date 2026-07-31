/**
 * GET /api/search — Cross-entity full-text search.
 *
 * Searches across Riders, Support Tickets, Vehicles, and Transactions.
 * Requires admin session with 'analytics_view' permission.
 *
 * Query params:
 *   q        — Search term (required, min 2 chars)
 *   entities — Comma-separated: riders,tickets,vehicles,transactions (default: all)
 *   limit    — Results per entity (default: 10, max: 50)
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'analytics_view')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const q = url.searchParams.get('q')?.trim();
    if (!q || q.length < 2) return success({ query: q, results: {} }, 'Search query too short');

    const entities = url.searchParams.get('entities')?.split(',').map((s) => s.trim()) || [
      'riders',
      'tickets',
      'vehicles',
      'transactions',
    ];
    const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);
    const pattern = `%${q}%`;

    const results: Record<string, any[]> = {};

    // Search riders
    if (entities.includes('riders')) {
      results.riders = await db.rider.findMany({
        where: {
          OR: [
            { riderId: { contains: q, mode: 'insensitive' } },
            { fullName: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, riderId: true, fullName: true, phone: true, lifecycleStatus: true },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
    }

    // Search tickets
    if (entities.includes('tickets')) {
      results.tickets = await db.supportTicket.findMany({
        where: {
          OR: [
            { subject: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { ticketId: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          ticketId: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
    }

    // Search vehicles
    if (entities.includes('vehicles')) {
      results.vehicles = await db.vehicle.findMany({
        where: {
          OR: [
            { vehicleNumber: { contains: q, mode: 'insensitive' } },
            { model: { contains: q, mode: 'insensitive' } },
            { maker: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          vehicleNumber: true,
          maker: true,
          model: true,
          status: true,
          batteryLevel: true,
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
    }

    // Search transactions
    if (entities.includes('transactions')) {
      results.transactions = await db.transaction.findMany({
        where: {
          OR: [{ description: { contains: q, mode: 'insensitive' } }, { type: { contains: q, mode: 'insensitive' } }],
        },
        select: {
          id: true,
          txnId: true,
          type: true,
          amount: true,
          status: true,
          purpose: true,
          createdAt: true,
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
    }

    return success({
      query: q,
      total: Object.values(results).reduce((sum, arr) => sum + arr.length, 0),
      results,
    });
  } catch (err: unknown) {
    logger.error('[Search] GET failed', { error: (err instanceof Error ? err.message : String(err)) });
    return errors.internal('Search failed');
  }
}
