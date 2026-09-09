import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/**
 * Coarse gate only — real authz happens in server components / route handlers
 * via lib/session. This just bounces anonymous users to /login.
 *
 * (Next 16 renamed the `middleware` convention to `proxy`.)
 */
export function proxy(req: NextRequest) {
  const isAuthed = !!getSessionCookie(req);
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === '/login' ||
    pathname === '/suspended' ||
    pathname === '/mobile-only' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/mobile') ||
    pathname.startsWith('/api/uploads') ||
    pathname.startsWith('/api/cron') || // guarded by CRON_SECRET
    pathname.startsWith('/api/export') || // guarded by requirePermission
    pathname === '/api/health';

  if (!isAuthed && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (isAuthed && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
