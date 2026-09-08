import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Big Ventures — Fleet Intelligence',
  description: 'Trip, fuel, cost and delivery intelligence for Big Ventures.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
