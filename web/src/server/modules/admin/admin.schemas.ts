import { z } from 'zod';
import { AdminRole } from './admin.types';

/**
 * Schema for creating a new admin user.
 */
export const CreateAdminSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  role: z.nativeEnum(AdminRole).default(AdminRole.OPERATIONS_ADMIN),
  permissions: z.array(z.string()).optional(),
});

/**
 * Schema for updating an existing admin user.
 */
export const UpdateAdminSchema = z.object({
  email: z.string().email('Valid email required').optional(),
  name: z.string().min(1).max(100).optional(),
  role: z.nativeEnum(AdminRole).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for admin login.
 */
export const AdminLoginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

/**
 * Schema for audit log query filters.
 */
export const AuditLogQuerySchema = z.object({
  entity: z.string().optional(),
  entityId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Schema for creating an audit log entry via API.
 */
export const CreateAuditLogSchema = z.object({
  action: z.string().min(1),
  entity: z.string().min(1),
  entityId: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});
