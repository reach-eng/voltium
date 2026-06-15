import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';

export const incidentUseCases = {
  async list(params: { status?: string; type?: string; severity?: string; search?: string; page?: number; limit?: number }) {
    const { status, type, severity, search, page = 1, limit = 20 } = params;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (search) {
      (where as any).OR = [
        { incidentId: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { rider: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [incidents, total] = await Promise.all([
      db.incident.findMany({
        where, orderBy: { createdAt: 'desc' },
        include: { rider: { select: { fullName: true, riderId: true, phone: true } }, vehicle: { select: { vehicleNumber: true, model: true } } },
        skip: (page - 1) * limit, take: limit,
      }),
      db.incident.count({ where }),
    ]);

    const formatted = (incidents as any[]).map((i) => ({
      id: i.id, incidentId: i.incidentId, riderId: i.riderId,
      riderName: i.rider?.fullName || i.rider?.phone || null, riderPhone: i.rider?.phone,
      vehicleId: i.vehicleId, vehicleNumber: i.vehicle?.vehicleNumber, vehicleModel: i.vehicle?.model,
      type: i.type, severity: i.severity, title: i.title, description: i.description,
      location: i.location, status: i.status, assignedTo: i.assignedTo, insuranceClaim: i.insuranceClaim,
      createdAt: i.createdAt, updatedAt: i.updatedAt,
    }));

    return { incidents: formatted, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async create(data: {
    riderId?: string; vehicleId?: string; type: string; severity: string; title: string;
    description: string; location?: string; latitude?: number; longitude?: number;
    photos?: string[]; insuranceClaim?: boolean; insuranceClaimNumber?: string;
  }, actorId: string) {
    if (data.riderId) {
      const rider = await db.rider.findUnique({ where: { id: data.riderId } });
      if (!rider) throw new Error('Rider not found');
    }
    if (data.vehicleId) {
      const vehicle = await db.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (!vehicle) throw new Error('Vehicle not found');
    }

    const count = await db.incident.count();
    const incidentId = `INC-${String(count + 1).padStart(5, '0')}`;

    const incident = await db.incident.create({
      data: {
        incidentId, riderId: data.riderId ?? null, vehicleId: data.vehicleId ?? null,
        type: data.type as 'ACCIDENT' | 'THEFT' | 'DAMAGE' | 'BREAKDOWN' | 'OTHER', severity: data.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', title: data.title, description: data.description ?? null,
        location: data.location ?? null, latitude: data.latitude ?? null, longitude: data.longitude ?? null,
        photos: JSON.stringify(data.photos ?? []), insuranceClaim: data.insuranceClaim ?? false,
        insuranceClaimNumber: data.insuranceClaimNumber || null,
      },
      include: { rider: { select: { fullName: true, riderId: true } }, vehicle: { select: { vehicleNumber: true } } },
    });

    createAuditLog({ actorId, action: 'incident.create', entity: 'incident', entityId: incident.id, details: { incidentId: incident.incidentId, type: data.type, severity: data.severity } }).catch((e) => logger.error('Audit log failed', e));
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

    return {
      id: incident.id,
      incidentId: incident.incidentId,
      riderId: incident.riderId,
      rider: incident.rider
        ? { fullName: incident.rider.fullName, riderId: incident.rider.riderId, phone: incident.rider.phone, email: incident.rider.email }
        : null,
      vehicleId: incident.vehicleId,
      vehicle: incident.vehicle
        ? { vehicleNumber: incident.vehicle.vehicleNumber, model: incident.vehicle.model, hubName: incident.vehicle.hub?.name }
        : null,
      type: incident.type,
      severity: incident.severity,
      title: incident.title,
      description: incident.description,
      location: incident.location,
      latitude: incident.latitude,
      longitude: incident.longitude,
      photos: JSON.parse(incident.photos),
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
    const updateData: Record<string, unknown> = {};
    if (data.status) updateData.status = data.status;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
    if (data.resolution !== undefined) updateData.resolution = data.resolution;
    if (data.insuranceClaim !== undefined) updateData.insuranceClaim = data.insuranceClaim;
    if (data.insuranceClaimNumber !== undefined) updateData.insuranceClaimNumber = data.insuranceClaimNumber;

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
