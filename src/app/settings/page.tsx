import { ArrowLeftIcon, CheckIcon, CircleDashedIcon, LogOutIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { appleEnabled, auth, configured, signOut } from '@/auth';
import { ProviderButton } from '@/components/auth/provider-button';
import { SyncButton } from '@/components/dashboard/sync-button';
import { DisplayForm } from '@/components/settings/display-form';
import { GoalsForm } from '@/components/settings/goals-form';
import { NameForm } from '@/components/settings/name-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getDb } from '@/db';
import { getProfile } from '@/lib/account';
import { getSettings } from '@/lib/settings-store';
import { lastSync, workoutCount } from '@/lib/sync/hevy';
import { cn } from '@/lib/utils';
import { signInWithProvider } from '../login/actions';

export const metadata: Metadata = { title: 'Settings · Master Dashboard' };
export const dynamic = 'force-dynamic';

const SECTIONS = [
  { id: 'goals', title: 'Goals & targets', blurb: 'What a good week looks like for you. The effort score, goal lines and nutrition bars measure against these.' },
  { id: 'display', title: 'Units & display', blurb: 'How numbers and weeks are shown across the dashboard.' },
  { id: 'account', title: 'Account & data sources', blurb: 'Your profile, how you sign in, and where your data comes from.' },
] as const;

const OTHER_SOURCES = [
  { name: 'Strava', what: 'Runs and rides' },
  { name: 'Oura', what: 'Sleep and HRV' },
  { name: 'Apple Health', what: 'Steps and weight' },
  { name: 'Nutrition app', what: 'Calories and macros' },
];

function ago(at: string): string {
  const m = Math.round((Date.now() - Date.parse(at)) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

function Section({ id, title, blurb, children }: { id: string; title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <h2 id={`${id}-title`} className="font-display text-2xl font-bold">
        {title}
      </h2>
      <p className="mt-1 mb-4 text-sm text-subtle">{blurb}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function SubCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn('gap-4 px-5 py-5', className)}>
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </Card>
  );
}

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', ok ? 'text-good' : 'text-muted-foreground')}>
      {ok ? <CheckIcon className="size-3.5" aria-hidden /> : <CircleDashedIcon className="size-3.5" aria-hidden />}
      {children}
    </span>
  );
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/settings');
  const db = await getDb();
  const [settings, profile, sync, workouts] = await Promise.all([getSettings(session.user.id), getProfile(session.user.id), lastSync(db), workoutCount(db)]);

  const name = profile?.name ?? session.user.name ?? '';
  const email = profile?.email ?? session.user.email ?? '';
  const image = profile?.image ?? session.user.image;
  const linked = new Set(profile?.providers ?? []);
  const methods = [
    { id: 'google' as const, name: 'Google', show: configured.google || linked.has('google') },
    { id: 'apple' as const, name: 'Apple', show: appleEnabled && (configured.apple || linked.has('apple')) },
  ].filter((m) => m.show);

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 pt-7 pb-16 sm:px-8">
      <header className="flex flex-col gap-3">
        <Link href="/" className="inline-flex w-fit items-center gap-1.5 text-sm text-subtle hover:text-foreground">
          <ArrowLeftIcon className="size-4" aria-hidden />
          Dashboard
        </Link>
        <h1 className="font-display text-[32px] leading-tight font-bold">Settings</h1>
      </header>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Settings sections" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
            {SECTIONS.map((s) => (
              <li key={s.id} className="shrink-0">
                <a href={`#${s.id}`} className="block rounded-[10px] px-3 py-2 text-sm font-medium whitespace-nowrap text-subtle hover:bg-white/5 hover:text-foreground">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-12">
          <Section {...SECTIONS[0]}>
            <Card className="px-5 py-5">
              <GoalsForm initial={settings.goals} />
            </Card>
          </Section>

          <Section {...SECTIONS[1]}>
            <Card className="px-5 py-5">
              <DisplayForm initial={{ units: settings.units, display: settings.display }} />
            </Card>
          </Section>

          <Section {...SECTIONS[2]}>
            <SubCard title="Profile">
              <div className="flex items-center gap-4">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote profile photo from the sign-in provider
                  <img src={image} alt="" referrerPolicy="no-referrer" className="size-14 rounded-full" />
                ) : (
                  <span aria-hidden className="grid size-14 place-items-center rounded-full bg-primary font-display text-2xl font-bold text-primary-foreground">
                    {(name || email || '?').charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold">{name || 'No name yet'}</div>
                  <div className="truncate text-sm text-subtle">{email}</div>
                </div>
              </div>
              <NameForm initial={name} />
            </SubCard>

            <SubCard title="Sign-in methods">
              <ul className="divide-y divide-grid">
                <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                  <div>
                    <div className="text-sm font-medium">Email code</div>
                    <div className="text-xs text-muted-foreground">A 6-digit code sent to {email || 'your email'}</div>
                  </div>
                  <Status ok={configured.resend}>{configured.resend ? 'Available' : 'Not set up'}</Status>
                </li>
                {methods.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 last:pb-0">
                    <div>
                      <div className="text-sm font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{linked.has(m.id) ? `Linked to this account` : `Sign in with your ${m.name} account too`}</div>
                    </div>
                    {linked.has(m.id) ? (
                      <Status ok>Linked</Status>
                    ) : (
                      <form action={signInWithProvider} className="w-[220px]">
                        <input type="hidden" name="provider" value={m.id} />
                        <input type="hidden" name="redirectTo" value="/settings#account" />
                        <ProviderButton provider={m.id} disabled={!configured[m.id]} />
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </SubCard>

            <SubCard title="Data sources">
              <ul className="divide-y divide-grid">
                <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      Hevy
                      <Status ok={!!sync}>{sync ? (sync.mock ? 'Sample data' : 'Connected') : 'Not synced yet'}</Status>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Workouts and body measurements
                      {sync && ` · ${workouts} workouts · last synced ${ago(sync.at)}`}
                      {sync?.mock && ' · set HEVY_API_KEY to use your real account'}
                    </div>
                  </div>
                  <SyncButton />
                </li>
                {OTHER_SOURCES.map((s) => (
                  <li key={s.name} className="flex flex-wrap items-center justify-between gap-3 py-3 last:pb-0">
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.what} · the dashboard shows sample data for now</div>
                    </div>
                    <Status ok={false}>Coming soon</Status>
                  </li>
                ))}
              </ul>
            </SubCard>

            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <Button type="submit" variant="outline" className="h-10 rounded-[10px]">
                <LogOutIcon aria-hidden />
                Sign out
              </Button>
            </form>
          </Section>
        </div>
      </div>
    </main>
  );
}
