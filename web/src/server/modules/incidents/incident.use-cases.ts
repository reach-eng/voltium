import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { validateIncidentTransition, type IncidentStatus } from './incident-state-machine';

export const incidentUseCases = {
  async list(params: {
    status?: string;
    type?: string;
    severity?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, type, severity, search, page = 1, limit = 20 } = params;
    const searchWhere: Prisma.IncidentWhereInput = {};
    if (type) searchWhere.type = type as Prisma.IncidentWhereInput['type'];
    if (severity) searchWhere.severity = severity as Prisma.IncidentWhereInput['severity'];
    if (search) {
      const trimmed = search.trim();
      searchWhere.OR = [
        { incidentId: { contains: trimmed, mode: 'insensitive' } },
        { title: { contains: trimmed, mode: 'insensitive' } },
        { description: { contains: trimmed, mode: 'insensitive' } },
        { rider: { fullName: { contains: trimmed, mode: 'insensitive' } } },
        { rider: { phone: { contains: trimmed } } },
        { vehicle: { vehicleNumber: { contains: trimmed, mode: 'insensitive' } } },
      ];
    }
    const where: Prisma.IncidentWhereInput = {
      ...searchWhere,
      ...(status ? { status: status as Prisma.IncidentWhereInput['status'] } : {}),
    };

    const [incidents, total, openCount, investigatingCount, resolvedCount, closedCount] = await Promise.all([
      db.incident.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          rider: { select: { fullName: true, riderId: true, phone: true } },
          vehicle: { select: { vehicleNumber: true, model: true } },
          assignedAdmin: { select: { name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.incident.count({ where }),
      db.incident.count({ where: { ...searchWhere, status: 'OPEN' } }),
      db.incident.count({ where: { ...searchWhere, status: 'INVESTIGATING' } }),
      db.incident.count({ where: { ...searchWhere, status: 'RESOLVED' } }),
      db.incident.count({ where: { ...searchWhere, status: 'CLOSED' } }),
    ]);

    const formatted = incidents.map((i) => ({
      id: i.id,
      incidentId: i.incidentId,
      riderId: i.riderId,
      riderName: i.rider?.fullName || i.rider?.phone || null,
      riderPhone: i.rider?.phone,
      vehicleId: i.vehicleId,
      vehicleNumber: i.vehicle?.vehicleNumber,
      vehicleModel: i.vehicle?.model,
      type: i.type,
      severity: i.severity,
      title: i.title,
      description: i.description,
      location: i.location,
      status: i.status,
      assignedTo: i.assignedAdmin?.name || i.assignedTo || null,
      assignedToName: i.assignedAdmin?.name || i.assignedTo || null,
      insuranceClaim: i.insuranceClaim,
      hasInsurance: Boolean(i.insuranceClaim),
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    }));

    return {
      incidents: formatted,
      statusCounts: {
        all: openCount + investigatingCount + resolvedCount + closedCount,
        OPEN: openCount,
        INVESTIGATING: investigatingCount,
        RESOLVED: resolvedCount,
        CLOSED: closedCount,
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async create(
    data: {
      riderId?: string;
      vehicleId?: string;
      type: string;
      severity: string;
      title: string;
      description: string;
      location?: string;
      latitude?: number;
      longitude?: number;
      photos?: string[];
      insuranceClaim?: boolean;
      insuranceClaimNumber?: string;
    },
    actorId: string
  ) {
    if (data.riderId) {
      const rider = await db.rider.findUnique({ where: { id: data.riderId } });
      if (!rider) throw new Error('Rider not found');
    }
    if (data.vehicleId) {
      const vehicle = await db.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (!vehicle) throw new Error('Vehicle not found');
    }

    const incidentId = `INC-${Date.now()}`;

    const incident = await db.incident.create({
      data: {
        incidentId,
        riderId: data.riderId ?? null,
        vehicleId: data.vehicleId ?? null,
        type: data.type as 'ACCIDENT' | 'THEFT' | 'DAMAGE' | 'BREAKDOWN' | 'OTHER',
        severity: data.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        title: data.title,
        description: data.description ?? null,
        location: data.location ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        photos: (data.photos ?? []) as unknown as Prisma.InputJsonValue,
        insuranceClaim: data.insuranceClaim ?? false,
        insuranceClaimNumber: data.insuranceClaimNumber || null,
      },
      include: {
        rider: { select: { fullName: true, riderId: true } },
        vehicle: { select: { vehicleNumber: true } },
      },
    });

    // Auto-update vehicle status to MAINTENANCE if breakdown, accident, or damage reported
    if (data.vehicleId && ['BREAKDOWN', 'ACCIDENT', 'DAMAGE'].includes(data.type)) {
      await db.vehicle.update({
        where: { id: data.vehicleId },
        data: { status: 'MAINTENANCE' },
      }).catch((err: unknown) => logger.warn('[IncidentUseCases] Failed to update vehicle status to MAINTENANCE', { vehicleId: data.vehicleId, err }));
    }

    createAuditLog({
      actorId,
      action: 'incident.create',
      entity: 'incident',
      entityId: incident.id,
      details: { incidentId: incident.incidentId, type: data.type, severity: data.severity },
    }).catch((e) => logger.error('Audit log failed', e));
    return incident;
  },

  async getIncident(id: string) {
    const incident = await db.incident.findUnique({
      where: { id },
      include: {
        rider: { select: { fullName: true, riderId: true, phone: true, email: true } },
        vehicle: { select: { vehicleNumber: true, model: true, hub: { select: { name: true } } } },
      },
    });

    if (!incident) return null;

    // PR-P3.1: photos is native Json — Prisma returns it as a parsed value
    // (or null). Coerce safely to string[] for the response shape.
    const parsedPhotos: string[] = Array.isArray(incident.photos)
      ? (incident.photos as unknown as string[])
      : [];

    return {
      id: incident.id,
      incidentId: incident.incidentId,
      riderId: incident.riderId,
      rider: incident.rider
        ? {
            fullName: incident.rider.fullName,
            riderId: incident.rider.riderId,
            phone: incident.rider.phone,
            email: incident.rider.email,
          }
        : null,
      vehicleId: incident.vehicleId,
      vehicle: incident.vehicle
        ? {
            vehicleNumber: incident.vehicle.vehicleNumber,
            model: incident.vehicle.model,
            hubName: incident.vehicle.hub?.name,
          }
        : null,
      type: incident.type,
      severity: incident.severity,
      title: incident.title,
      description: incident.description,
      location: incident.location,
      latitude: incident.latitude,
      longitude: incident.longitude,
      photos: parsedPhotos,
      status: incident.status,
      assignedTo: incident.assignedTo,
      resolution: incident.resolution,
      resolvedAt: incident.resolvedAt,
      resolvedBy: incident.resolvedBy,
      insuranceClaim: incident.insuranceClaim,
      insuranceClaimNumber: incident.insuranceClaimNumber,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
    };
  },

  async updateIncident(id: string, data: Record<string, unknown>, actorId: string) {
    if (data.status) {
      const existing = await db.incident.findUnique({ where: { id }, select: { status: true } });
      if (!existing) throw new Error('Incident not found');
      validateIncidentTransition(existing.status as IncidentStatus, data.status as IncidentStatus);
    }

    const updateData: Record<string, unknown> = {};
    if (data.status) updateData.status = data.status;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
    if (data.resolution !== undefined) updateData.resolution = data.resolution;
    if (data.insuranceClaim !== undefined) updateData.insuranceClaim = data.insuranceClaim;
    if (data.insuranceClaimNumber !== undefined)
      updateData.insuranceClaimNumber = data.insuranceClaimNumber;

    if (data.status === 'RESOLVED' || data.status === 'CLOSED') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = actorId;
    }

    const incident = await db.incident.update({ where: { id }, data: updateData });

    createAuditLog({
      actorId,
      action: data.status ? `incident.${(data.status as string).toLowerCase()}` : 'incident.update',
      entity: 'incident',
      entityId: id,
      details: updateData,
    }).catch((e) => logger.error('Audit log failed for incident update', e));

    return incident;
  },
};
