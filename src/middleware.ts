import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

// The database-free config: the middleware only reads the session cookie
export const { auth: middleware } = NextAuth(authConfig);

// Everything needs a signed-in user except the sign-in flow itself, static files,
// and /api/sync, which also accepts the cron secret and checks the session on its own.
export const config = {
  matcher: ['/((?!login|api/auth|api/sync|_next/static|_next/image|avatar/|favicon.ico).*)'],
};
