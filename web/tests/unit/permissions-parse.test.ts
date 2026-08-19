import { describe, it, expect } from 'vitest';
import { parsePermissions, serializePermissions } from '@/lib/permissions';

describe('parsePermissions (P0-6 typed helper)', () => {
  it('parses a JSON string array', () => {
    expect(parsePermissions('["riders_view","kyc_view"]')).toEqual(['riders_view', 'kyc_view']);
  });

  it('returns [] for null / undefined / empty input', () => {
    expect(parsePermissions(null)).toEqual([]);
    expect(parsePermissions(undefined)).toEqual([]);
    expect(parsePermissions('')).toEqual([]);
  });

  it('returns [] for invalid JSON and non-array JSON', () => {
    expect(parsePermissions('{bad json')).toEqual([]);
    expect(parsePermissions('42')).toEqual([]);
    expect(parsePermissions('{"a":1}')).toEqual([]);
  });

  it('passes already-parsed arrays through (legacy shape)', () => {
    expect(parsePermissions(['riders_view', 'kyc_view'])).toEqual(['riders_view', 'kyc_view']);
    expect(parsePermissions([])).toEqual([]);
  });

  it('filters non-string entries', () => {
    expect(parsePermissions(['a', 42, null, 'b'] as unknown as string[])).toEqual(['a', 'b']);
  });
});

describe('serializePermissions', () => {
  it('stringifies an array back to the DB column format', () => {
    expect(serializePermissions(['a', 'b'])).toBe('["a","b"]');
    expect(serializePermissions([])).toBe('[]');
  });
});
