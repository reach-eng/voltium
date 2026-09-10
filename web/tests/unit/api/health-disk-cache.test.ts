import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process.execFileSync before importing the module under test.
const execFileSyncMock = vi.fn();
vi.mock('child_process', () => ({
  execFileSync: execFileSyncMock,
}));

const { getDiskUsageCached, clearDiskCacheForTests, getDiskUsageRaw } = await import(
  '@/app/api/health/_diskCache'
);

describe('_diskCache — 60s TTL disk probe (P1-1)', () => {
  beforeEach(() => {
    clearDiskCacheForTests();
    execFileSyncMock.mockReset();
  });

  afterEach(() => {
    clearDiskCacheForTests();
  });

  it('calls the subprocess once on the first probe', () => {
    execFileSyncMock.mockReturnValue('1073741824,536870912'); // 1 GB total, 0.5 GB free
    getDiskUsageCached();
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
  });

  it('does not call the subprocess again on subsequent reads within 60s', () => {
    execFileSyncMock.mockReturnValue('1073741824,536870912');
    for (let i = 0; i < 10; i += 1) {
      getDiskUsageCached();
    }
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
  });

  it('re-probes after the cache is cleared', () => {
    execFileSyncMock.mockReturnValue('1073741824,536870912');
    getDiskUsageCached();
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
    clearDiskCacheForTests();
    getDiskUsageCached();
    expect(execFileSyncMock).toHaveBeenCalledTimes(2);
  });

  it('returns MB rounded values, not bytes', () => {
    execFileSyncMock.mockReturnValue('1073741824,536870912'); // 1024 MB, 512 MB
    const v = getDiskUsageCached();
    expect(v.totalMB).toBe(1024);
    expect(v.freeMB).toBe(512);
    expect(v.usagePercent).toBe(50);
  });

  it('caches a zeroed fallback if the subprocess throws (existing failure mode)', () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error('df not found');
    });
    // Capture the call count after the first invocation: one call
    // to getDiskUsageCached() probes twice (Windows PowerShell, then
    // POSIX `df` fallback). The second invocation must NOT probe
    // again because the cache short-circuits.
    getDiskUsageCached();
    const callCountAfterFirst = execFileSyncMock.mock.calls.length;
    expect(callCountAfterFirst).toBeGreaterThan(0); // we did probe
    getDiskUsageCached();
    expect(execFileSyncMock).toHaveBeenCalledTimes(callCountAfterFirst);
    const v = getDiskUsageCached();
    expect(v.totalMB).toBe(0);
    expect(v.freeMB).toBe(0);
  });

  it('getDiskUsageRaw bypasses the cache (test helper, not for production)', () => {
    execFileSyncMock.mockReturnValue('1073741824,536870912');
    getDiskUsageRaw();
    getDiskUsageRaw();
    expect(execFileSyncMock).toHaveBeenCalledTimes(2);
  });
});
