'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error]', error);
  }, [error]);

  // WEB-AUDIT 2026-08-14 P0-3: the previous version pinned all
  // colors to hex (light red `#D92D20`, light gray `#667085`,
  // light blue `#0053C1`). When the rider had dark mode on,
  // the global error page rendered as a hard-white screen
  // with hard-coded colors — completely ignoring the user's
  // theme. We now apply `prefers-color-scheme` via a small
  // inline `<style>` block so the error page is readable in
  // both modes. The hex palette is taken from the brand
  // tokens (--vf-*) defined in `app/globals.css` but used
  // directly because the global-error component runs
  // outside the theme provider.
  return (
    <html>
      <head>
        <style>{`
          :root {
            --ge-bg: #ffffff;
            --ge-fg: #0f172a;
            --ge-muted: #667085;
            --ge-meta: #98a2b3;
            --ge-danger: #d92d20;
            --ge-primary: #0053C1;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --ge-bg: #0f172a;
              --ge-fg: #f8fafc;
              --ge-muted: #94a3b8;
              --ge-meta: #64748b;
              --ge-danger: #fca5a5;
              --ge-primary: #84B1ED;
            }
          }
          body { background: var(--ge-bg); color: var(--ge-fg); margin: 0; }
        `}</style>
      </head>
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1
            style={{
              fontSize: '2rem',
              marginBottom: '1rem',
              color: 'var(--ge-danger)',
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              color: 'var(--ge-muted)',
              marginBottom: '1.5rem',
              textAlign: 'center',
            }}
          >
            We encountered an unexpected error. Our team has been notified.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--ge-meta)',
                marginBottom: '1.5rem',
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--ge-primary)',
              color: 'var(--ge-bg)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
