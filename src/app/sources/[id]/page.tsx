import { ArrowLeftIcon, SettingsIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppleHealthDataView } from '@/components/sources/apple-health-data';
import { HevyDataView } from '@/components/sources/hevy-data';
import { SourceLogo } from '@/components/sources/source-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getDb } from '@/db';
import { getStatus } from '@/lib/apple-health/store';
import { getSettings } from '@/lib/settings-store';
import { getAppleHealthData, getHevyData } from '@/lib/source-data';
import { SOURCES, type SourceId } from '@/lib/sources';
import { lastSync, workoutCount } from '@/lib/sync/hevy';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = SOURCES.find((x) => x.id === id);
  return { title: `${s?.name ?? 'Source'} data · Master Dashboard` };
}

const VIA = { 'export-file': 'Health export upload', shortcut: 'Shortcuts', 'auto-export': 'Health Auto Export' } as const;

function ago(at: string): string {
  const m = Math.round((Date.now() - Date.parse(at)) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

type Tone = 'good' | 'sample' | 'idle';
const PILL: Record<Tone, string> = { good: 'bg-good/15 text-good', sample: 'bg-primary/15 text-primary', idle: 'bg-white/[0.06] text-muted-foreground' };
const DOT: Record<Tone, string> = { good: 'bg-good', sample: 'bg-primary', idle: 'bg-muted-foreground' };

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const info = SOURCES.find((s) => s.id === id);
  if (!info) notFound();
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/sources/${id}`);

  const db = await getDb();
  const [settings, sync, workouts, health] = await Promise.all([getSettings(session.user.id), lastSync(db), workoutCount(db), getStatus(session.user.id)]);
  const healthDays = health?.lastReceivedAt ? (await getAppleHealthData(db)) : null;
  const healthCount = healthDays ? Object.values(healthDays).reduce((n, list) => n + (list?.length ?? 0), 0) : 0;

  // status, record count and a one-line note for every source, for the switcher and header
  const status: Record<SourceId, { tone: Tone; label: string; count: number | null; note: string }> = {
    hevy: {
      tone: !sync ? 'idle' : sync.mock ? 'sample' : 'good',
      label: !sync ? 'Not synced yet' : sync.mock ? 'Sample data' : 'Connected',
      count: workouts,
      note: sync ? `Last synced ${ago(sync.at)}` : 'Not synced yet',
    },
    'apple-health': {
      tone: health?.lastReceivedAt ? 'good' : health ? 'sample' : 'idle',
      label: health?.lastReceivedAt ? 'Connected' : health ? 'Setup in progress' : 'Not connected',
      count: healthCount || null,
      note: health?.lastReceivedAt ? `Last delivery ${ago(health.lastReceivedAt)}${health.summary?.via ? ` · ${VIA[health.summary.via]}` : ''}` : 'Nothing has arrived yet',
    },
    strava: { tone: 'idle', label: 'Coming soon', count: null, note: 'Not connected' },
    oura: { tone: 'idle', label: 'Coming soon', count: null, note: 'Not connected' },
    nutrition: { tone: 'idle', label: 'Coming soon', count: null, note: 'Not connected' },
    lyfta: { tone: 'idle', label: 'Coming soon', count: null, note: 'Not connected' },
  };
  const me = status[info.id];
  const hevyData = info.id === 'hevy' && sync ? await getHevyData(db) : null;

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pt-7 pb-16 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-3">
          <Link href="/" className="inline-flex w-fit items-center gap-1.5 text-sm text-subtle hover:text-foreground">
            <ArrowLeftIcon className="size-4" aria-hidden />
            Dashboard
          </Link>
          <h1 className="font-display text-[32px] leading-tight font-bold">Source data</h1>
        </div>
        <Button asChild variant="outline" className="h-10 rounded-[10px]">
          <Link href="/settings#sources">
            <SettingsIcon aria-hidden />
            Manage sources
          </Link>
        </Button>
      </header>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Sources" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:pb-0">
            {SOURCES.map((s) => {
              const st = status[s.id];
              const active = s.id === info.id;
              return (
                <li key={s.id} className="shrink-0">
                  <Link
                    href={`/sources/${s.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn('flex items-center gap-3 rounded-[12px] px-2.5 py-2 transition-colors', active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]')}
                  >
                    <SourceLogo id={s.id} size={32} />
                    <span className="min-w-0 pr-1">
                      <span className={cn('block text-sm whitespace-nowrap', active ? 'font-semibold' : 'text-subtle')}>{s.name}</span>
                      <span className="flex items-center gap-1.5 text-[11px] whitespace-nowrap text-muted-foreground">
                        <span className={cn('size-1.5 rounded-full', DOT[st.tone])} aria-hidden />
                        {st.count != null ? `${st.count.toLocaleString()} ${s.id === 'hevy' ? 'workouts' : 'values'}` : st.label}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-5">
          <Card className="flex-row flex-wrap items-center gap-4 px-5 py-5">
            <SourceLogo id={info.id} size={56} />
            <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-2xl font-bold">{info.name}</h2>
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', PILL[me.tone])}>
                  <span className={cn('size-1.5 rounded-full', DOT[me.tone])} aria-hidden />
                  {me.label}
                </span>
              </div>
              <p className="text-sm text-subtle">
                {info.via} · {me.note}
              </p>
            </div>
          </Card>

          {info.id === 'hevy' && hevyData && <HevyDataView data={hevyData} units={settings.units} mock={!!sync?.mock} />}
          {info.id === 'apple-health' && healthDays && <AppleHealthDataView data={healthDays} units={settings.units} />}

          {((info.id === 'hevy' && !hevyData) || (info.id === 'apple-health' && !healthDays) || !['hevy', 'apple-health'].includes(info.id)) && (
            <Card className="items-center gap-3 px-6 py-12 text-center">
              <SourceLogo id={info.id} size={48} className="opacity-60" />
              <h3 className="text-lg font-semibold">Nothing has come through {info.name} yet</h3>
              <p className="max-w-md text-sm text-subtle">
                {['strava', 'oura', 'nutrition', 'lyfta'].includes(info.id)
                  ? `${info.name} isn't connected yet. Once it is, everything it sends (${info.provides.join(', ').toLowerCase()}) will be listed here.`
                  : `Connect it from Settings and every ${info.provides.join(', ').toLowerCase()} record it sends will show up here.`}
              </p>
              {['hevy', 'apple-health'].includes(info.id) && (
                <Button asChild className="mt-2 rounded-[10px]">
                  <Link href="/settings#sources">Go to Data sources</Link>
                </Button>
              )}
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
