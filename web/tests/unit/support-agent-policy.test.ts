import { describe, it, expect } from 'vitest';
import { supportPolicy } from '@/server/modules/support/support.policy';
import { AdminRole } from '@/server/modules/admin/admin.types';

describe('Support Agent Policy Roles', () => {
  it('allows SUPPORT_AGENT role to manage and resolve tickets', () => {
    expect(supportPolicy.canManageTickets(AdminRole.SUPPORT_AGENT)).toBe(true);
    expect(supportPolicy.canResolveTicket(AdminRole.SUPPORT_AGENT)).toBe(true);
  });
});
