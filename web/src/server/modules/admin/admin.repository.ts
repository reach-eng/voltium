import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { AdminRole } from './admin.types';

export interface CreateAdminParams {
  email: string;
  password: string;
  name: string;
  role: AdminRole;
  permissions?: string[];
}

export interface UpdateAdminParams {
  email?: string;
  name?: string;
  role?: AdminRole;
  password?: string;
  permissions?: string[];
  isActive?: boolean;
}

export const adminRepository = {
  async findById(id: string) {
    return db.admin.findUnique({ where: { id } });
  },

  async findByEmail(email: string) {
    return db.admin.findUnique({ where: { email } });
  },

  async list(filters?: { role?: string; isActive?: boolean; search?: string; page?: number; limit?: number }) {
    const where: any = {};
    if (filters?.role) where.role = filters.role;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { email: { contains: filters.search } },
      ];
    }
    return db.admin.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: filters?.page ? (filters.page - 1) * (filters.limit || 20) : undefined,
      take: filters?.limit || undefined,
    });
  },

  async create(params: CreateAdminParams) {
    const hashed = await hashPassword(params.password);
    return db.admin.create({
      data: {
        email: params.email,
        password: hashed,
        name: params.name,
        role: params.role,
        permissions: JSON.stringify(params.permissions || []),
      },
    });
  },

  async update(id: string, params: UpdateAdminParams) {
    const data: any = {};
    if (params.email !== undefined) data.email = params.email;
    if (params.name !== undefined) data.name = params.name;
    if (params.role !== undefined) data.role = params.role;
    if (params.password !== undefined) data.password = params.password;
    if (params.permissions !== undefined) data.permissions = JSON.stringify(params.permissions);
    if (params.isActive !== undefined) data.isActive = params.isActive;

    return db.admin.update({ where: { id }, data });
  },

  async delete(id: string) {
    return db.admin.delete({ where: { id } });
  },

  async updateLastLogin(id: string) {
    return db.admin.update({ where: { id }, data: { lastLoginAt: new Date() } });
  },

  async incrementTokenVersion(id: string) {
    return db.admin.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
  },

  async bulkActivateTeamLeaders(ids: string[]) {
    return db.teamLeader.updateMany({ where: { id: { in: ids } }, data: { isActive: true } });
  },

  async bulkDeactivateTeamLeaders(ids: string[]) {
    return db.teamLeader.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
  },

  async bulkDeleteTeamLeaders(ids: string[]) {
    return db.teamLeader.deleteMany({ where: { id: { in: ids } } });
  },

  async getAuditLogs(filters: {
    entity?: string;
    entityId?: string;
    actorId?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) {
    const { entity, entityId, actorId, action, page = 1, limit = 50 } = filters;
    const where: any = {};
    if (entity) where.entity = entity;
    if (entityId) where.entityId = entityId;
    if (actorId) where.actorId = actorId;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ]);

    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
