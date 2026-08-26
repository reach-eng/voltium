import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { SkipLink } from '@/components/ui/skip-link';
import { Providers } from './providers';
import { SITE_TITLE, META_DESCRIPTION, FAVICON_PATH } from '@/lib/branding';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta-sans',
});

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: META_DESCRIPTION,
  keywords: [
    'Voltium',
    'Voltium Electric Mobility',
    'Electric Vehicle',
    'Fleet Management',
    'Scooter Rental',
  ],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: SITE_TITLE,
  },
  icons: {
    icon: FAVICON_PATH,
    apple: FAVICON_PATH,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          as="style"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
        {process.env.NODE_ENV === 'production' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').then(function(registration) {
                      console.log('SW registered');
                    }, function(err) {
                      console.log('SW registration failed: ', err);
                    });
                  });
                }
              `,
            }}
          />
        )}
      </head>
      <body className={`antialiased max-w-full overflow-x-hidden ${plusJakartaSans.className}`} suppressHydrationWarning>
        <SkipLink />
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
