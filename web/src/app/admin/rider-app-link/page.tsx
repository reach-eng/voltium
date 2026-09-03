'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function RiderAppLinkPage() {
  useEffect(() => {
    // Attempt to open the custom URL scheme
    const appUrl = 'voltium://';
    const storeUrl = 'https://play.google.com/store/apps/details?id=com.voltiumelectric.voltium';
    
    // Set a timeout to redirect to the store if the app doesn't open
    const timeout = setTimeout(() => {
      window.location.href = storeUrl;
    }, 2500);

    // Try to open the app
    window.location.href = appUrl;

    // Cleanup timeout if the component unmounts
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
      <div className="p-8 max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Opening Rider App...</h1>
        <p className="text-muted-foreground">
          If the app doesn't open automatically, we'll redirect you to the app store in a few seconds.
        </p>
      </div>
    </div>
  );
}
