import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from './providers';
import { SITE_TITLE, META_DESCRIPTION, FAVICON_PATH } from '@/lib/branding';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: META_DESCRIPTION,
  keywords: [
    'Ryd',
    'Ryd Electric Mobility',
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
  maximumScale: 1,
  userScalable: false,
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
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
