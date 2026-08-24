// See mrr-rent-payment-filter.test.ts for the existing P0-5 / PR-79
// regression guard. This placeholder was kept because the file system
// wouldn't allow deletion of empty test files; vitest requires at
// least one test in a file, so the assertion below is a no-op.
import { it, expect, describe } from 'vitest';

describe('prisma-only-aggregations placeholder', () => {
  it('is a no-op — see mrr-rent-payment-filter.test.ts for the real P0-5 coverage', () => {
    expect(true).toBe(true);
  });
});
