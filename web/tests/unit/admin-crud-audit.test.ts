import { describe, it, expect } from 'vitest';

describe('Admin CRUD and Security Audit Fixes', () => {
  it('createAdminSchema enforces PasswordComplexitySchema', async () => {
    const { createAdminSchema } = await import('../../src/lib/validators/admin');

    const invalid = createAdminSchema.safeParse({
      name: 'Test Admin',
      email: 'test@example.com',
      password: 'password123', // missing uppercase & special char
      role: 'OPERATIONS_ADMIN',
    });

    expect(invalid.success).toBe(false);

    const valid = createAdminSchema.safeParse({
      name: 'Test Admin',
      email: 'test@example.com',
      password: 'Password123!',
      role: 'OPERATIONS_ADMIN',
    });

    expect(valid.success).toBe(true);
  });

  it('adminUseCases exports deleteAdmin and listAdmins', async () => {
    const { adminUseCases } = await import('../../src/server/modules/admin/admin.use-cases');
    expect(adminUseCases.deleteAdmin).toBeDefined();
    expect(adminUseCases.listAdmins).toBeDefined();
  });
});
