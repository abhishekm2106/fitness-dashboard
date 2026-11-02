import { ArrowLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { CodeForm } from '@/components/auth/code-form';
import { getPending } from '@/lib/auth/pending';
import { resendEmailCode } from '../actions';
import { WRONG_CODE } from '../messages';
import { AuthAlert, AuthShell } from '../shell';

export const metadata: Metadata = { title: 'Enter your code · Master Dashboard' };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams;
  if ((await auth())?.user) redirect('/');
  const pending = await getPending();
  if (!pending) redirect('/login');

  const localOnly = !process.env.AUTH_RESEND_KEY && process.env.NODE_ENV !== 'production';

  return (
    <AuthShell>
      <div>
        <div className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Master Dashboard</div>
        <h1 className="mt-2 font-display text-[34px] leading-tight font-bold">Check your email</h1>
        <p className="mt-2 text-subtle">
          We sent a 6-digit code to <b className="break-all text-foreground">{pending.email}</b>. Enter it below, or tap the link in the email.
        </p>
      </div>

      {error && <AuthAlert>{WRONG_CODE}</AuthAlert>}
      {notice === 'wait' && <AuthAlert tone="info">A code was sent a few seconds ago. Give it a moment to arrive before asking for another.</AuthAlert>}
      {notice === 'sent' && <AuthAlert tone="info">New code sent. Earlier codes no longer work.</AuthAlert>}
      {localOnly && (
        <AuthAlert tone="info">
          Local mode: no email is sent until <code>AUTH_RESEND_KEY</code> is set. The code is printed in the terminal running <code>npm run dev</code>.
        </AuthAlert>
      )}

      <CodeForm email={pending.email} callbackUrl={pending.redirectTo} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-subtle hover:text-foreground">
          <ArrowLeftIcon className="size-4" aria-hidden />
          Use a different email
        </Link>
        <form action={resendEmailCode}>
          <button type="submit" className="font-medium text-primary hover:underline">
            Send a new code
          </button>
        </form>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">The code expires in 10 minutes. Didn&apos;t get it? Check your spam folder.</p>
    </AuthShell>
  );
}
