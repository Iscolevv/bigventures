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
};

export default config;
