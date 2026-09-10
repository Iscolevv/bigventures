import type { MetadataRoute } from 'next';

/**
 * PWA manifest. Lets drivers "Add to Home Screen" / "Install app" and get a
 * standalone, full-screen app that opens straight to the driver home (`/d`).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Big Ventures Driver',
    short_name: 'Big Ventures',
    description: 'Trips, deliveries and proof of delivery for Big Ventures drivers.',
    start_url: '/d',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f7f6',
    theme_color: '#1f5f4f',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
