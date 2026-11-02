import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { appleEnabled, auth, configured } from '@/auth';
import { EmailForm } from '@/components/auth/email-form';
import { ProviderButton } from '@/components/auth/provider-button';
import { getPending, safePath } from '@/lib/auth/pending';
import { sendEmailCode, signInWithProvider } from './actions';
import { WRONG_CODE } from './messages';
import { AuthAlert, AuthShell } from './shell';

export const metadata: Metadata = { title: 'Sign in · Master Dashboard' };

const ERRORS: Record<string, string> = {
  AccessDenied: "This account isn't allowed to open this dashboard. Sign in with an email on the allowlist.",
  Configuration: 'Sign-in isn’t set up correctly on the server. Check the AUTH_ settings in the environment.',
  OAuthCallbackError: 'The sign-in was cancelled or didn’t complete. Try again.',
  OAuthSignInError: 'Couldn’t start the sign-in. Try again.',
  OAuthAccountNotLinked: 'That email already signs in another way. Use the method you used before.',
  EmailSignInError: 'Couldn’t send the email. Try again in a moment.',
  InvalidEmail: 'That doesn’t look like an email address.',
  Verification: WRONG_CODE,
};

const OAUTH = [
  { id: 'google', env: 'AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET' },
  { id: 'apple', env: 'AUTH_APPLE_ID and AUTH_APPLE_SECRET' },
] as const;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const { callbackUrl, error } = await searchParams;
  const redirectTo = safePath(callbackUrl);
  if ((await auth())?.user) redirect(redirectTo);
  // a wrong code bounces back here from Auth.js; keep the person on the code screen
  if (error === 'Verification' && (await getPending())) redirect('/login/verify?error=Verification');

  const dev = process.env.NODE_ENV !== 'production';
  // Apple is behind ENABLE_APPLE_SIGNIN; otherwise local dev shows unconfigured buttons as setup hints
  const oauth = OAUTH.filter((p) => (p.id !== 'apple' || appleEnabled) && (dev || configured[p.id]));
  const message = error ? (ERRORS[error] ?? 'Something went wrong while signing in. Try again.') : null;

  return (
    <AuthShell>
      <div>
        <div className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Master Dashboard</div>
        <h1 className="mt-2 font-display text-[34px] leading-tight font-bold">Welcome back</h1>
        <p className="mt-2 text-subtle">Sign in to see your workouts, recovery and nutrition in one place.</p>
      </div>

      {message && <AuthAlert>{message}</AuthAlert>}

      {oauth.length > 0 && (
        <div className="flex flex-col gap-3">
          {oauth.map((p) => (
            <form key={p.id} action={signInWithProvider}>
              <input type="hidden" name="provider" value={p.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <ProviderButton provider={p.id} disabled={!configured[p.id]} />
              {!configured[p.id] && (
                <p className="mt-1.5 text-center text-xs text-muted-foreground">
                  Not set up yet: add {p.env} to <code>.env.local</code>
                </p>
              )}
            </form>
          ))}
        </div>
      )}

      {configured.resend && (
        <>
          {oauth.length > 0 && (
            <div className="flex items-center gap-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
          )}
          <EmailForm action={sendEmailCode} redirectTo={redirectTo} />
        </>
      )}

      {!oauth.length && !configured.resend && <p className="text-sm text-muted-foreground">No sign-in methods are configured on this server.</p>}

      <p className="text-xs leading-relaxed text-muted-foreground">
        This is a private dashboard. Only emails on its allowlist can sign in, and your data never leaves your own database.
      </p>
    </AuthShell>
  );
}
