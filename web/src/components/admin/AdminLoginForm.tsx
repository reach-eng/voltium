'use client';
import { useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAdminLoginDefaults } from '@/lib/admin-login-defaults';
import { setAdminRefreshToken } from '@/lib/admin-refresh-token';
import type { SessionPayload } from '@/lib/session-payload';

// P3-1: extracted from AdminLayout.tsx — the admin login form is the only
// unauthenticated screen, so it lives in its own file.
export function AdminLoginForm({
  loginLoading,
  setLoginLoading,
  onAuthenticated,
}: {
  loginLoading: boolean;
  setLoginLoading: (loading: boolean) => void;
  onAuthenticated: (data: SessionPayload) => void;
}) {
  // P0-1: credentials are pre-filled ONLY in development builds (where the
  // dev admin exists). In every other environment the fields start empty so
  // `admin123` can never appear in the SSR'd page source or browser autofill.
  const loginDefaults = getAdminLoginDefaults();
  const [email, setEmail] = useState(loginDefaults.email);
  const [password, setPassword] = useState(loginDefaults.password);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        // P1-6: a proxy (502 HTML) may not return JSON — don't assume res.json() succeeds.
        let message = 'Invalid email or password';
        try {
          const data = await res.json();
          message = data?.error?.message || message;
        } catch {
          // non-JSON error body
        }
        setErrorMsg(message);
        return;
      }
      // P1-13: stash the refresh token for the background interceptor.
      try {
        const data = await res.json();
        if (data?.data?.refreshToken) setAdminRefreshToken(data.data.refreshToken);
      } catch {
        // non-JSON success body — the session cookie is still set
      }
      // P1-3: no full-page reload — re-read the session and switch to the
      // admin view in place (router.refresh() wouldn't re-run the auth
      // effect, so this is the minimal state switch).
      const meRes = await fetch('/api/admin/auth/me', { credentials: 'include' });
      if (meRes.ok) {
        try {
          const me = await meRes.json();
          if (me?.success && me?.data?.role) {
            onAuthenticated(me.data as SessionPayload);
            return;
          }
        } catch {
          // fall through to reload
        }
      }
      window.location.reload(); // last resort: the cookie is set, a reload authenticates
    } catch (err) {
      setErrorMsg('Connection error — please try again');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-background p-6">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-black mb-2 tracking-tight">Voltium Admin</h1>
        <p className="text-sm text-muted-foreground mb-6 font-medium">
          Sign in with your administrator credentials to access the management portal.
        </p>

        {errorMsg && (
          <div className="w-full mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold text-left">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handlePasswordLogin} className="w-full space-y-4 text-left">
          <div className="space-y-1.5">
            <Label htmlFor="admin-email">Email Address</Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="admin@voltium.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full font-bold shadow-xl shadow-primary/20 mt-2"
            disabled={loginLoading}
          >
            {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In as Admin'}
          </Button>
        </form>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground mt-6"
          onClick={() => (window.location.href = '/rider-app')}
        >
          Return to Rider App
        </Button>
      </div>
    </div>
  );
}
