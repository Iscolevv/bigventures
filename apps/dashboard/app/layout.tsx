import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Big Ventures — Fleet Intelligence',
  description: 'Trip, fuel, cost and delivery intelligence for Big Ventures.',
  applicationName: 'Big Ventures',
  appleWebApp: {
    capable: true,
    title: 'Big Ventures',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#1f5f4f',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
