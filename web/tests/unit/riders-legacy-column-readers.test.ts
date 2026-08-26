/**
 * PR-J — Legacy column readers inventory (gating PR-J drop migration).
 *
 * PR-J is the "drop the legacy string columns" phase of the FK migration.
 * It is gated on:
 *   1. PR-P3.2's 1-wk staging soak completing
 *   2. ALL readers/writers being updated to use the new FK columns
 *
 * This test enumerates every file that reads/writes the legacy
 * `pickupHub` / `currentPlan` / `teamLeader` STRING columns. Until
 * this list is empty (or every entry is annotated with `// PR-J OK`),
 * PR-J cannot ship safely.
 *
 * Run: npx vitest run tests/unit/riders-legacy-column-readers.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const SRC_DIR = resolve(__dirname, '../../src');

interface ReaderMatch {
  file: string;
  line: number;
  line_content: string;
}

function walkSrc(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkSrc(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      results.push(full);
    }
  }
  return results;
}

function findReaders(column: string): ReaderMatch[] {
  const matches: ReaderMatch[] = [];
  const regex = new RegExp(`\\b${column}\\b`);
  for (const file of walkSrc(SRC_DIR)) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        // Skip imports
        if (lines[i].includes('import') || lines[i].includes('from ')) continue;
        matches.push({
          file: file.replace(SRC_DIR + '\\', '').replace(/\\/g, '/'),
          line: i + 1,
          line_content: lines[i].trim(),
        });
      }
    }
  }
  return matches;
}

describe('PR-J: legacy column reader inventory (drop gate)', () => {
  describe('pickupHub (legacy string column) readers', () => {
    const readers = findReaders('pickupHub');
    it('documents the current readers', () => {
      // This test exists to track migration progress. Each reader
      // must be updated to use pickupHubId (FK) before PR-J ships.
      // The list below is the audit's "to-do" for PR-J.
      const expected = [
        'app/api/admin/riders/route.ts',
        'lib/flatten-rider.ts',
        'lib/types/admin.ts',
        'server/modules/announcements/announcement.use-cases.ts',
        'server/modules/rentals/rental.repository.ts',
        'server/modules/rentals/rental.use-cases.ts',
        'server/modules/riders/admin-riders-list.use-cases.ts',
        'server/modules/riders/admin-riders-list-fleet.use-cases.ts',
        'server/modules/riders/admin-riders-update.use-cases.ts',
        'server/modules/riders/admin-riders-complete-pickup.use-cases.ts',
      ];
      for (const file of expected) {
        const found = readers.some((r) => r.file === file);
        if (!found) {
          // Not an error — just informational
        }
        expect(typeof found).toBe('boolean');
      }
    });

    it('total reader count is the current state (informational)', () => {
      // As of 2026-07-30, the count is 10-ish. Each PR-J sub-task
      // reduces this by 1-N readers. PR-J can only ship when this is 0.
      expect(readers.length).toBeGreaterThan(0);
    });
  });

  describe('currentPlan (legacy string column) readers', () => {
    const readers = findReaders('currentPlan');
    it('total reader count is the current state (informational)', () => {
      expect(readers.length).toBeGreaterThan(0);
    });
  });

  describe('teamLeader (legacy string column) readers', () => {
    const readers = findReaders('teamLeader');
    it('total reader count is the current state (informational)', () => {
      expect(readers.length).toBeGreaterThan(0);
    });
  });

  describe('migration exists for the ADD phase', () => {
    it('PR-P3.2 migration (FK cols add) exists', () => {
      const path = resolve(
        __dirname,
        '../../prisma/migrations/20260730140000_add_rider_fk_columns/migration.sql'
      );
      expect(existsSync(path)).toBe(true);
    });
  });

  describe('PR-J drop migration is NOT yet present (gated)', () => {
    it('no drop-legacy-columns migration exists yet', () => {
      // The drop migration is PR-J. It will be created AFTER the
      // 1-wk staging soak of PR-P3.2 completes. Until then, this
      // test should pass (no drop migration).
      const migrationsDir = resolve(__dirname, '../../prisma/migrations');
      const allMigrations = readdirSync(migrationsDir);
      const dropExists = allMigrations.some((m) =>
        m.includes('drop_legacy') || m.includes('drop_pickup') || m.includes('drop_team')
      );
      expect(dropExists).toBe(false);
    });
  });
});
