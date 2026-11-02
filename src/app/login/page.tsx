import { CircleAlertIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { AuthError } from 'next-auth';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { auth, configured, signIn, type ProviderId } from '@/auth';
import { ProviderButton } from '@/components/auth/provider-button';
import s from './login.module.css';

export const metadata: Metadata = { title: 'Sign in · Master Dashboard' };

const ERRORS: Record<string, string> = {
  AccessDenied: "This account isn't allowed to open this dashboard. Sign in with the account on the allowlist.",
  Configuration: 'Sign-in isn’t set up correctly on the server. Check the AUTH_ settings in the environment.',
  OAuthCallbackError: 'The sign-in was cancelled or didn’t complete. Try again.',
  OAuthSignInError: 'Couldn’t start the sign-in. Try again.',
};

// Keep only the path, so the login page can't be used to redirect to another site
function safePath(p: string | undefined): string {
  if (!p) return '/';
  try {
    const url = new URL(p, 'http://local');
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}

const PROVIDERS: { id: ProviderId; env: string }[] = [
  { id: 'google', env: 'AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET' },
  { id: 'apple', env: 'AUTH_APPLE_ID and AUTH_APPLE_SECRET' },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const { callbackUrl, error } = await searchParams;
  const redirectTo = safePath(callbackUrl);
  if ((await auth())?.user) redirect(redirectTo);

  const dev = process.env.NODE_ENV !== 'production';
  const shown = PROVIDERS.filter((p) => dev || configured[p.id]);
  const message = error ? (ERRORS[error] ?? 'Something went wrong while signing in. Try again.') : null;

  async function start(formData: FormData) {
    'use server';
    const provider = formData.get('provider') as ProviderId;
    try {
      await signIn(provider, { redirectTo });
    } catch (err) {
      // signIn redirects by throwing; only Auth.js errors are real failures
      if (err instanceof AuthError) redirect(`/login?error=${err.type}`);
      throw err;
    }
  }

  return (
    <main className={s.page}>
      <div className={s.shell}>
        <div className={s.stage} aria-hidden="true">
          <div className={s.hud}>
            <div className={s.eyebrow}>Training · Recovery · Nutrition</div>
            <div className="font-display text-[28px] leading-tight font-bold">Ready when you are</div>
            <div className={s.bars} />
          </div>
          <div className={s.floor} />
          <div className={s.fig}>
            <Image src="/avatar/toned-thumbs.png" alt="" fill sizes="400px" priority />
          </div>
          <span className={s.spark} style={{ left: '14%', top: '38%' }} />
          <span className={s.spark} style={{ left: '80%', top: '30%', animationDelay: '.8s' }} />
          <span className={s.spark} style={{ left: '72%', top: '62%', width: 11, height: 11, animationDelay: '1.6s' }} />
        </div>

        <div className={s.panel}>
          <div>
            <div className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Master Dashboard</div>
            <h1 className="mt-2 font-display text-[34px] leading-tight font-bold">Welcome back</h1>
            <p className="mt-2 text-subtle">Sign in to see your workouts, recovery and nutrition in one place.</p>
          </div>

          {message && (
            <div role="alert" className="flex gap-2.5 rounded-xl border border-bad/40 bg-bad/10 px-3.5 py-3 text-sm">
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
              <span>{message}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {shown.map((p) => (
              <form key={p.id} action={start}>
                <input type="hidden" name="provider" value={p.id} />
                <ProviderButton provider={p.id} disabled={!configured[p.id]} />
                {!configured[p.id] && (
                  <p className="mt-1.5 text-center text-xs text-muted-foreground">
                    Not set up yet: add {p.env} to <code>.env.local</code>
                  </p>
                )}
              </form>
            ))}
            {!shown.length && <p className="text-sm text-muted-foreground">No sign-in methods are configured on this server.</p>}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            This is a private dashboard. Only accounts on its allowlist can sign in, and your data never leaves your own database.
          </p>
        </div>
      </div>
    </main>
  );
}
