'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { signIn, type ProviderId } from '@/auth';
import { codeSentAt } from '@/lib/auth/adapter';
import { CODE_TTL_SECONDS } from '@/lib/auth/email';
import { getPending, safePath, setPending } from '@/lib/auth/pending';

// Pressing "send" again within this window reuses the code already on its way
const RESEND_AFTER_MS = 30_000;

// signIn redirects by throwing; only Auth.js errors are real failures
async function start(provider: ProviderId, options: Record<string, string | boolean>) {
  try {
    await signIn(provider, options);
  } catch (err) {
    if (err instanceof AuthError) redirect(`/login?error=${err.type}`);
    throw err;
  }
}

// Sends the code, then shows our code page instead of Auth.js's own verify-request URL
async function emailCode(email: string, redirectTo: string, notice?: string) {
  await start('resend', { email, redirectTo, redirect: false });
  redirect(notice ? `/login/verify?notice=${notice}` : '/login/verify');
}

export async function signInWithProvider(formData: FormData) {
  await start(formData.get('provider') as ProviderId, { redirectTo: safePath(formData.get('redirectTo')) });
}

export async function sendEmailCode(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const redirectTo = safePath(formData.get('redirectTo'));
  if (!/^[^\s@"]+@[^\s@"]+\.[^\s@"]+$/.test(email)) redirect('/login?error=InvalidEmail');
  await setPending({ email, redirectTo });
  const sentAt = await codeSentAt(email, CODE_TTL_SECONDS);
  if (sentAt && Date.now() - sentAt.getTime() < RESEND_AFTER_MS) redirect('/login/verify');
  await emailCode(email, redirectTo);
}

export async function resendEmailCode() {
  const pending = await getPending();
  if (!pending) redirect('/login');
  const sentAt = await codeSentAt(pending.email, CODE_TTL_SECONDS);
  if (sentAt && Date.now() - sentAt.getTime() < RESEND_AFTER_MS) redirect('/login/verify?notice=wait');
  await emailCode(pending.email, pending.redirectTo, 'sent');
}
