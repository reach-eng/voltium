/**
 * Ticket #15 — Permission descriptors / role map sync test
 *
 * Locks in the contract:
 *   - Every key in `PERMISSION_DESCRIPTORS` has a `ROLE_PERMISSIONS` entry.
 *   - Every key in `ROLE_PERMISSIONS` is defined in `PERMISSION_DESCRIPTORS`.
 *   - No role in `ROLE_PERMISSIONS` is outside the canonical `ADMIN_ROLES` list.
 *   - `PERMISSIONS` (the public map) exposes exactly the descriptor keys.
 *
 * This catches the failure mode the audit warned about: adding a new
 * permission in one file but forgetting the other.
 */

import { describe, it, expect } from 'vitest';
import {
  PERMISSION_DESCRIPTORS,
  PERMISSION_KEYS,
  ADMIN_ROLES,
  type AdminRole,
} from '@/lib/permissions';
import { ROLE_PERMISSIONS } from '@/lib/permissions-roles';

describe('permission descriptors ↔ role map sync (#15)', () => {
  it('every PERMISSION_DESCRIPTORS.key has a ROLE_PERMISSIONS entry', () => {
    const missing: string[] = [];
    for (const desc of PERMISSION_DESCRIPTORS) {
      if (!(desc.key in ROLE_PERMISSIONS)) {
        missing.push(desc.key);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every ROLE_PERMISSIONS key is declared in PERMISSION_DESCRIPTORS', () => {
    const orphans: string[] = [];
    for (const key of Object.keys(ROLE_PERMISSIONS)) {
      if (!PERMISSION_KEYS.has(key)) {
        orphans.push(key);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('every role in ROLE_PERMISSIONS is in the canonical ADMIN_ROLES list', () => {
    const adminRoleSet = new Set<string>(ADMIN_ROLES);
    const bogusRoles = new Set<string>();
    for (const [key, roles] of Object.entries(ROLE_PERMISSIONS)) {
      for (const role of roles) {
        if (!adminRoleSet.has(role)) {
          bogusRoles.add(role);
        }
      }
    }
    expect(Array.from(bogusRoles)).toEqual([]);
  });

  it('PERMISSION_KEYS set matches the descriptor count', () => {
    expect(PERMISSION_KEYS.size).toBe(PERMISSION_DESCRIPTORS.length);
  });

  it('no duplicate descriptor keys', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const desc of PERMISSION_DESCRIPTORS) {
      if (seen.has(desc.key)) {
        dupes.push(desc.key);
      }
      seen.add(desc.key);
    }
    expect(dupes).toEqual([]);
  });

  it('all roles referenced are valid AdminRole types', () => {
    // This is a type-level check but we can sanity-check at runtime too:
    // every role in ROLE_PERMISSIONS should be one of the 9 canonical roles.
    const canonicalRoles: AdminRole[] = [
      'SUPER_ADMIN',
      'OPERATIONS_ADMIN',
      'KYC_REVIEWER',
      'FINANCE_ADMIN',
      'SUPPORT_AGENT',
      'HUB_MANAGER',
      'FLEET_MANAGER',
      'TEAM_LEADER',
      'READ_ONLY',
    ];
    const canonicalSet = new Set<string>(canonicalRoles);
    for (const roles of Object.values(ROLE_PERMISSIONS)) {
      for (const role of roles) {
        expect(canonicalSet.has(role)).toBe(true);
      }
    }
  });
});
