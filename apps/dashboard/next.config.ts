import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  // This app lives in a pnpm monorepo; point Turbopack at the workspace root
  // so it resolves @bv/core and @bv/db (and ignores stray lockfiles elsewhere).
  turbopack: {
    root: path.join(__dirname, '..', '..'),
  },
  transpilePackages: ['@bv/core', '@bv/db'],
  serverExternalPackages: [
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
    'pg',
    'kysely',
  ],
  experimental: {
    serverActions: {
      // Default is 1MB. The driver quick-log flow submits every stop's proof-
      // of-delivery photo in one Server Action call, so a couple of camera
      // photos alone can clear 1MB and the action was silently failing.
      bodySizeLimit: '25mb',
    },
  },
};

export default config;
