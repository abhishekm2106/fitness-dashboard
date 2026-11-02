import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

// The database-free config: the middleware only reads the session cookie
export const { auth: middleware } = NextAuth(authConfig);

// Everything needs a signed-in user except the sign-in flow itself, static files,
// /api/sync, which also accepts the cron secret and checks the session on its own,
// and /api/ingest, which phones call with a per-source token instead of a session.
export const config = {
  matcher: ['/((?!login|api/auth|api/sync|api/ingest|_next/static|_next/image|avatar/|favicon.ico).*)'],
};
