import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '@/lib/db';

describe('AdminPermissions migration', () => {
  beforeEach(async () => {
    // Setup initial state: clear both tables
    await db.adminHasPermission.deleteMany({});
    await db.admin.deleteMany({});
  });

  afterAll(async () => {
    await db.adminHasPermission.deleteMany({});
    await db.admin.deleteMany({});
  });

  it('migrates legacy permissions array into relational table correctly', async () => {
    const adminId1 = 'test-admin-1';
    const adminId2 = 'test-admin-2';
    
    // Create test admins using legacy permissions array
    await db.$executeRawUnsafe(`
      INSERT INTO "admins" ("id", "email", "password", "name", "role", "permissions", "updatedAt")
      VALUES 
      ('${adminId1}', 'mig1@test.com', 'pwd', 'mig1', 'SUPER_ADMIN', ARRAY['VIEW_DASHBOARD', 'MANAGE_USERS']::text[], NOW()),
      ('${adminId2}', 'mig2@test.com', 'pwd', 'mig2', 'OPERATIONS_ADMIN', ARRAY['VIEW_REPORTS']::text[], NOW())
    `);
    
    // Run the migration script manually to simulate the migration
    await db.$executeRawUnsafe(`
      INSERT INTO "admin_has_permissions" ("id", "adminId", "permission", "createdAt")
      SELECT
        gen_random_uuid()::text || '-' || row_number() OVER ()::text,
        "id",
        unnest("permissions"),
        NOW()
      FROM "admins"
      WHERE "permissions" IS NOT NULL
        AND array_length("permissions", 1) > 0
      ON CONFLICT DO NOTHING;
    `);

    const p1 = await db.adminHasPermission.findMany({ where: { adminId: adminId1 } });
    expect(p1.map(p => p.permission).sort()).toEqual(['MANAGE_USERS', 'VIEW_DASHBOARD']);
    
    const p2 = await db.adminHasPermission.findMany({ where: { adminId: adminId2 } });
    expect(p2.map(p => p.permission)).toEqual(['VIEW_REPORTS']);
  });

  it('is idempotent when run twice', async () => {
    const adminId = 'test-admin-idempotent';
    await db.$executeRawUnsafe(`
      INSERT INTO "admins" ("id", "email", "password", "name", "role", "permissions", "updatedAt")
      VALUES 
      ('${adminId}', 'mig3@test.com', 'pwd', 'mig3', 'SUPER_ADMIN', ARRAY['VIEW_DASHBOARD']::text[], NOW())
    `);

    // Run first time
    await db.$executeRawUnsafe(`
      INSERT INTO "admin_has_permissions" ("id", "adminId", "permission", "createdAt")
      SELECT
        gen_random_uuid()::text || '-' || row_number() OVER ()::text,
        "id",
        unnest("permissions"),
        NOW()
      FROM "admins"
      WHERE "permissions" IS NOT NULL
        AND array_length("permissions", 1) > 0
      ON CONFLICT DO NOTHING;
    `);
    
    // Run second time
    await db.$executeRawUnsafe(`
      INSERT INTO "admin_has_permissions" ("id", "adminId", "permission", "createdAt")
      SELECT
        gen_random_uuid()::text || '-' || row_number() OVER ()::text,
        "id",
        unnest("permissions"),
        NOW()
      FROM "admins"
      WHERE "permissions" IS NOT NULL
        AND array_length("permissions", 1) > 0
      ON CONFLICT DO NOTHING;
    `);

    const p = await db.adminHasPermission.findMany({ where: { adminId } });
    expect(p.length).toBe(1);
    expect(p[0].permission).toBe('VIEW_DASHBOARD');
  });
});
