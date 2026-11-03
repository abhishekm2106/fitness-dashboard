import { ClockIcon, DatabaseIcon, InfoIcon, PlugIcon, TableIcon } from 'lucide-react';
import Link from 'next/link';
import { SyncButton } from '@/components/dashboard/sync-button';
import { AppleHealthCard, type AppleHealthStatus } from '@/components/settings/apple-health-card';
import { SourceLogo } from '@/components/sources/source-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SOURCES, type SourceInfo } from '@/lib/sources';
import { cn } from '@/lib/utils';

type Tone = 'good' | 'sample' | 'idle';

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap',
        tone === 'good' && 'bg-good/15 text-good',
        tone === 'sample' && 'bg-primary/15 text-primary',
        tone === 'idle' && 'bg-white/[0.06] text-muted-foreground',
      )}
    >
      <span className={cn('size-1.5 rounded-full', tone === 'good' ? 'bg-good' : tone === 'sample' ? 'bg-primary' : 'bg-muted-foreground')} aria-hidden />
      {children}
    </span>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Provides">
      {items.map((x) => (
        <li key={x} className="rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-subtle">
          {x}
        </li>
      ))}
    </ul>
  );
}

function ago(at: string): string {
  const m = Math.round((Date.now() - Date.parse(at)) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

function Stat({ icon: Icon, label, value }: { icon: typeof ClockIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-[10px] bg-[#141413] px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function HevyCard({ info, sync, workouts }: { info: SourceInfo; sync: { at: string; mock: boolean } | null; workouts: number }) {
  const tone: Tone = !sync ? 'idle' : sync.mock ? 'sample' : 'good';
  return (
    <Card className="relative gap-0 overflow-hidden border-primary/25 p-0 shadow-[0_20px_60px_-30px_rgba(79,216,230,0.35)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_0%_0%,rgba(79,216,230,0.10),transparent_60%)]" />
      <div className="relative flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <SourceLogo id="hevy" size={56} />
          {/* the min width makes Sync now drop to its own line on narrow screens */}
          <div className="flex min-w-[200px] flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="font-display text-xl font-bold">{info.name}</h3>
              <Pill tone={tone}>{!sync ? 'Not synced yet' : sync.mock ? 'Sample data' : 'Connected'}</Pill>
            </div>
            <p className="text-sm text-subtle">{info.via}. Feeds {info.feeds}.</p>
            <Chips items={info.provides} />
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {sync && (
              <Button asChild variant="outline" className="h-10 rounded-[10px]">
                <Link href="/sources/hevy">
                  <TableIcon aria-hidden />
                  View data
                </Link>
              </Button>
            )}
            <SyncButton />
          </div>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <Stat icon={DatabaseIcon} label="Workouts stored" value={String(workouts)} />
          <Stat icon={ClockIcon} label="Last synced" value={sync ? ago(sync.at) : 'Never'} />
          <Stat icon={PlugIcon} label="Mode" value={!sync ? '–' : sync.mock ? 'Sample data' : 'Your account'} />
        </div>
        {sync?.mock && (
          <p className="flex gap-2 rounded-[10px] border border-primary/25 bg-primary/[0.07] px-3.5 py-2.5 text-[13px] text-subtle">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              Showing realistic sample workouts. Add <code className="text-foreground">HEVY_API_KEY</code> to <code className="text-foreground">.env.local</code> (Hevy Pro → Settings → Developer)
              and sync to pull in your real history.
            </span>
          </p>
        )}
      </div>
    </Card>
  );
}

function UpcomingCard({ info }: { info: SourceInfo }) {
  return (
    <Card className="min-w-0 gap-3 px-4 py-4">
      <div className="flex items-center gap-3">
        <SourceLogo id={info.id} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{info.name}</h3>
          <p className="truncate text-xs text-muted-foreground">{info.via}</p>
        </div>
        <Pill tone="idle">Coming soon</Pill>
      </div>
      <Chips items={info.provides} />
      <p className="text-xs text-muted-foreground">{info.note ?? `Until then the dashboard shows sample data for ${info.feeds}.`}</p>
    </Card>
  );
}

export function DataSources({
  sync,
  workouts,
  appleHealth,
  endpoint,
}: {
  sync: { at: string; mock: boolean } | null;
  workouts: number;
  appleHealth: AppleHealthStatus | null;
  endpoint: string;
}) {
  const hevy = SOURCES.find((s) => s.id === 'hevy')!;
  const rest = SOURCES.filter((s) => s.id !== 'hevy' && s.id !== 'apple-health');
  return (
    <div className="flex flex-col gap-5">
      <HevyCard info={hevy} sync={sync} workouts={workouts} />
      <AppleHealthCard status={appleHealth} endpoint={endpoint} />
      <div>
        <h3 className="mb-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Coming next</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {rest.map((s) => (
            <UpcomingCard key={s.id} info={s} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Hevy counts once it syncs your real account; Apple Health once a delivery has arrived
export const connectedCount = (sync: { mock: boolean } | null, appleHealth: AppleHealthStatus | null) =>
  (sync && !sync.mock ? 1 : 0) + (appleHealth?.lastReceivedAt ? 1 : 0);
