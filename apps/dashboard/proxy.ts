import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/**
 * Coarse gate only - real authz happens in server components / route handlers
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
    pathname === '/manifest.webmanifest' ||
    pathname === '/icon' ||
    pathname === '/apple-icon' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/mobile') ||
    pathname.startsWith('/api/uploads') ||
    pathname.startsWith('/api/cron') || // guarded by CRON_SECRET
    pathname.startsWith('/api/export') || // guarded by requirePermission
    pathname === '/api/health';

  if (!isAuthed && !isPublic) {
    const url = new URL('/login', req.url);
    // Send them back to where they were headed once they sign in - this is how a
    // link in an email (e.g. "approve this trip") lands on that page, not the home screen.
    if (pathname !== '/') url.searchParams.set('next', pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  // Never bounce /login on the cookie alone: the cookie can outlive its session
  // (account removed, session expired), and the app then redirects back to /login
  // -> infinite loop. Signing in simply replaces the stale cookie.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
