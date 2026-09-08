import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@bv/core', '@bv/db'],
  serverExternalPackages: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
};

export default config;
