import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SCHEMA_PATH = resolve(__dirname, '../../prisma/schema.prisma');

describe('Schema Timestamp Standardization', () => {
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');

  it('no models contain snake_case timestamp mappings', () => {
    expect(schema).not.toContain('@map("created_at")');
    expect(schema).not.toContain('@map("updated_at")');
    expect(schema).not.toContain('@map("deleted_at")');
    expect(schema).not.toContain('createdAt_at');
    expect(schema).not.toContain('created_at');
    expect(schema).not.toContain('updated_at');
  });

  it('Faq model defines standard camelCase deletedAt', () => {
    const faqBlock = schema.split('model Faq {')[1]?.split('}')[0];
    expect(faqBlock).toBeDefined();
    expect(faqBlock).toContain('deletedAt DateTime?');
    expect(faqBlock).not.toContain('@map("deleted_at")');
  });

  it('all models with audit timestamps use standard camelCase createdAt and updatedAt', () => {
    const lines = schema.split('\n');
    for (const line of lines) {
      if (line.includes('DateTime') && (line.includes('created') || line.includes('updated'))) {
        expect(line.trim()).toMatch(/^(createdAt|updatedAt|lastSentAt|processedAt|approvedAt|rejectedAt|refundedAt|forfeitedAt|resolvedAt|escalatedAt|startedAt|completedAt|lastRunAt|nextRunAt|resetAt|expiresAt|paidAt|readyAt)/);
      }
    }
  });
});
