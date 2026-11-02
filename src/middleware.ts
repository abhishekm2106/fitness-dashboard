export { auth as middleware } from '@/auth';

// Everything needs a signed-in user except the sign-in flow itself, static files,
// and /api/sync, which also accepts the cron secret and checks the session on its own.
export const config = {
  matcher: ['/((?!login|api/auth|api/sync|_next/static|_next/image|avatar/|favicon.ico).*)'],
};
