'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Global error page for the Next.js App Router.
 *
 * Catches rendering errors in the server component tree
 * (layout, page, or nested segments) and shows a recovery UI.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[GlobalError]', {
        name: error.name,
        message: error.message,
        digest: error.digest,
      });
    }
  }, [error]);

  return (
    <html>
      <body className="antialiased bg-background text-foreground">
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-3xl font-black mb-3 tracking-tight">Critical Error</h1>
          <p className="text-muted-foreground mb-6 max-w-md text-center text-sm">
            A critical error occurred while rendering this page. Our team has been notified.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <details className="mb-6 max-w-lg w-full">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground font-medium">
                Error details (dev only)
              </summary>
              <pre className="mt-2 text-xs bg-muted p-4 rounded-lg overflow-auto max-h-40 text-destructive">
                {error.name}: {error.message}
                {error.digest && `\nDigest: ${error.digest}`}
              </pre>
            </details>
          )}
          <div className="flex gap-3">
            <Button
              onClick={() => reset()}
              className="inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = '/')}
            >
              Go Home
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
