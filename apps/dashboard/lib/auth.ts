import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { ROLES } from '@bv/core/enums';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const auth = betterAuth({
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'),
  emailAndPassword: {
    enabled: true,
    // Accounts are created by ops/admin from the dashboard, not self-serve.
    disableSignUp: false,
  },
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'driver', input: false },
      status: { type: 'string', defaultValue: 'invited', input: false },
      phone: { type: 'string', required: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  trustedOrigins: [
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
    // the Expo app authenticates against this same backend
    'bigventures://',
  ],
});

export type AppRole = (typeof ROLES)[number];
