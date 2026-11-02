import NextAuth, { type NextAuthConfig } from 'next-auth';
import Apple from 'next-auth/providers/apple';
import Google from 'next-auth/providers/google';

export type ProviderId = 'google' | 'apple';

// A provider is offered only once its client id and secret are set
export const configured: Record<ProviderId, boolean> = {
  google: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  apple: !!(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET),
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

const config = {
  providers: [...(configured.google ? [Google] : []), ...(configured.apple ? [Apple] : [])],
  pages: { signIn: '/login', error: '/login' },
  session: { strategy: 'jwt' },
  trustHost: true,
  cookies: secure
    ? { callbackUrl: crossSite('callback-url'), state: crossSite('state', 900), nonce: crossSite('nonce'), pkceCodeVerifier: crossSite('pkce.code_verifier', 900) }
    : undefined,
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider === 'google' && profile?.email_verified === false) return false;
      return allowed(profile?.email);
    },
    // Used by middleware: pages redirect to /login, API routes get a 401
    authorized({ auth, request }) {
      if (auth?.user) return true;
      if (request.nextUrl.pathname.startsWith('/api/')) return Response.json({ error: 'Sign in first.' }, { status: 401 });
      return false;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(config);
