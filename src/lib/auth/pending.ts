import { cookies } from 'next/headers';
import { CODE_TTL_SECONDS } from './email';

// Remembers which email is waiting for a code, so the address stays out of the code page's URL
const COOKIE = 'md.pending-signin';

type Pending = { email: string; redirectTo: string };

export async function setPending(p: Pending) {
  (await cookies()).set(COOKIE, JSON.stringify(p), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/login',
    maxAge: CODE_TTL_SECONDS,
  });
}

export async function getPending(): Promise<Pending | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<Pending>;
    return typeof p.email === 'string' ? { email: p.email, redirectTo: safePath(p.redirectTo) } : null;
  } catch {
    return null;
  }
}

/** Keeps only the path, so sign-in can't be used to redirect to another site */
export function safePath(p: unknown): string {
  if (typeof p !== 'string' || !p) return '/';
  try {
    const url = new URL(p, 'http://local');
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}
