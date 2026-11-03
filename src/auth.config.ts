import type { NextAuthConfig } from 'next-auth';
import Apple from 'next-auth/providers/apple';
import Google from 'next-auth/providers/google';

// Shared by the middleware (Edge runtime, no database) and src/auth.ts (adds email sign-in and storage).

export type ProviderId = 'google' | 'apple' | 'resend';

// Sign in with Apple stays hidden everywhere until this is "true" (it needs a paid Apple Developer account)
export const appleEnabled = process.env.ENABLE_APPLE_SIGNIN === 'true';

// A provider is offered only once it's set up. Locally, email codes print in the terminal until Resend is set up.
export const configured: Record<ProviderId, boolean> = {
  google: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  apple: appleEnabled && !!(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET),
  resend: !!process.env.AUTH_RESEND_KEY || process.env.NODE_ENV !== 'production',
};

// This is a personal dashboard: only these emails may sign in.
// Without a list, anyone can sign in locally but nobody can in production.
function allowed(email: string | null | undefined): boolean {
  const list = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return process.env.NODE_ENV !== 'production';
  return !!email && list.includes(email.toLowerCase());
}

// Apple returns to the callback with a cross-site form POST, which drops SameSite=Lax cookies,
// so the cookies that check the round trip have to be SameSite=None (and therefore Secure).
const secure = process.env.NODE_ENV === 'production';
const crossSite = (name: string, maxAge?: number) => ({
  name: `__Secure-authjs.${name}`,
  options: { httpOnly: true, sameSite: 'none' as const, path: '/', secure: true, ...(maxAge ? { maxAge } : {}) },
});

// Google and Apple verify the email, so a login with the same email joins the existing account
export const authConfig = {
  providers: [
    ...(configured.google ? [Google({ allowDangerousEmailAccountLinking: true })] : []),
    ...(configured.apple ? [Apple({ allowDangerousEmailAccountLinking: true })] : []),
  ],
  pages: { signIn: '/login', error: '/login', verifyRequest: '/login/verify' },
  session: { strategy: 'jwt' },
  trustHost: true,
  cookies: secure
    ? { callbackUrl: crossSite('callback-url'), state: crossSite('state', 900), nonce: crossSite('nonce'), pkceCodeVerifier: crossSite('pkce.code_verifier', 900) }
    : undefined,
  callbacks: {
    // runs before a code is emailed too, so codes only go to allowed addresses
    signIn({ user, account, profile }) {
      if (account?.provider === 'google' && profile?.email_verified === false) return false;
      return allowed(profile?.email ?? user?.email);
    },
    // Used by middleware: pages redirect to /login, API routes get a 401
    authorized({ auth, request }) {
      if (auth?.user) return true;
      if (request.nextUrl.pathname.startsWith('/api/')) return Response.json({ error: 'Sign in first.' }, { status: 401 });
      return false;
    },
  },
} satisfies NextAuthConfig;
