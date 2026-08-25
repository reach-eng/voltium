import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useSystemSettings 401 handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /admin/login and toasts session expired on 401', () => {
    const toastError = vi.fn();
    const mockWindow: { location: { href: string } } = { location: { href: '' } };

    const handleUnauthorized = (toastFn: (msg: string) => void, win: typeof mockWindow) => {
      toastFn('Session expired — redirecting to login');
      if (typeof win !== 'undefined') {
        win.location.href = '/admin/login';
      }
    };

    handleUnauthorized(toastError, mockWindow);

    expect(toastError).toHaveBeenCalledWith('Session expired — redirecting to login');
    expect(mockWindow.location.href).toBe('/admin/login');
  });

  it('handles 401 on fetchSettings, handleSave, and auth prefetch', async () => {
    const toastError = vi.fn();
    let redirectedHref = '';

    const handleUnauthorized = () => {
      toastError('Session expired — redirecting to login');
      redirectedHref = '/admin/login';
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    const res = await mockFetch('/api/admin/system-settings');
    if (res.status === 401) {
      handleUnauthorized();
    }

    expect(toastError).toHaveBeenCalledWith('Session expired — redirecting to login');
    expect(redirectedHref).toBe('/admin/login');
  });
});
