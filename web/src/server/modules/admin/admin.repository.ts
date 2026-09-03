import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { AdminRole } from './admin.types';
import type { Prisma } from '@prisma/client';

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

  async list(filters?: {
    role?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    // P3-18: typed where — `any` hid typos like a missing `OR` array.
    const where: Prisma.AdminWhereInput = {};
    if (filters?.role) where.role = filters.role as AdminRole;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.search) {
      where.OR = [{ name: { contains: filters.search } }, { email: { contains: filters.search } }];
    }
    return db.admin.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: filters?.page ? (filters.page - 1) * (filters.limit || 20) : undefined,
      take: filters?.limit || undefined,
    });
  },

  async count(filters?: {
    role?: string;
    isActive?: boolean;
    search?: string;
  }) {
    const where: Prisma.AdminWhereInput = {};
    if (filters?.role) where.role = filters.role as AdminRole;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.search) {
      where.OR = [{ name: { contains: filters.search } }, { email: { contains: filters.search } }];
    }
    return db.admin.count({ where });
  },

  async create(params: CreateAdminParams) {
    const hashed = await hashPassword(params.password);
    return db.admin.create({
      data: {
        email: params.email,
        password: hashed,
        name: params.name,
        role: params.role,
        // P3-19: the column is TEXT[] (migration 20260730000000) — write the
        // raw array. JSON.stringify produced a JSON string the DB rejected as
        // a malformed array literal (only an empty '[]' happened to parse).
        permissions: params.permissions || [],
      },
    });
  },

  async update(id: string, params: UpdateAdminParams) {
    // P3-19: typed data — `any` let the JSON-string-into-TEXT[] lie compile.
    const data: Prisma.AdminUpdateInput = {};
    if (params.email !== undefined) data.email = params.email;
    if (params.name !== undefined) data.name = params.name;
    if (params.role !== undefined) data.role = params.role;
    if (params.password !== undefined) data.password = params.password;
    if (params.permissions !== undefined) data.permissions = params.permissions;
    if (params.isActive !== undefined) data.isActive = params.isActive;

    const shouldInvalidateSession =
      params.password !== undefined || params.role !== undefined || params.permissions !== undefined || params.isActive !== undefined;

    if (shouldInvalidateSession) {
      return db.$transaction(async (tx) => {
        await tx.admin.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
        return tx.admin.update({ where: { id }, data });
      });
    }

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


  async getAuditLogs(filters: {
    entity?: string;
    entityId?: string;
    actorId?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) {
    const { entity, entityId, actorId, action, page = 1, limit = 50 } = filters;
    // P3-18: typed where.
    const where: Prisma.AuditLogWhereInput = {};
    if (entity) where.entity = entity;
    if (entityId) where.entityId = entityId;
    if (actorId) where.actorId = actorId;
    // 2026-08-05 ops audit: action is a free-text string (TEXT column,
    // migration 20260811000000) — no enum cast needed.
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
