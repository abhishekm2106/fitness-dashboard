'use client';

import { AlertTriangleIcon, BookOpenIcon, CalendarClockIcon, CheckIcon, HistoryIcon, KeyRoundIcon, Loader2Icon, PlugIcon, TableIcon, UnplugIcon, ZapIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { disconnectAppleHealth } from '@/app/settings/actions';
import { SourceLogo } from '@/components/sources/source-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { METRIC_GUIDE, type AppleHealthStatus } from '@/lib/apple-health/status';
import { cn } from '@/lib/utils';
import { AppleHealthSetup, rememberedMethod, type GuideTarget } from './apple-health-setup';
import { ago, CopyField } from './setup-parts';

export type { AppleHealthStatus };

const VIA = { 'export-file': 'Health export upload', shortcut: 'Shortcuts', 'auto-export': 'Health Auto Export' } as const;

export function AppleHealthCard({ status, endpoint }: { status: AppleHealthStatus | null; endpoint: string }) {
  const router = useRouter();
  const [guide, setGuide] = useState<{ open: boolean; target: GuideTarget }>({ open: false, target: { method: null, step: 'choose' } });
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const live = !!status?.lastReceivedAt;
  const openGuide = (target: GuideTarget) => setGuide({ open: true, target });
  // pick up where the chosen method left off: after the key if one exists
  const resume = (): GuideTarget => {
    const m = rememberedMethod();
    if (m === 'shortcut') return { method: m, step: status?.secretHint ? 'recipe' : 'key' };
    if (m === 'hae') return { method: m, step: status?.secretHint ? 'automation' : 'key' };
    return { method: null, step: 'choose' };
  };
  const via = status?.summary?.via ? VIA[status.summary.via] : null;

  const remove = () =>
    start(async () => {
      const res = await disconnectAppleHealth();
      if (!res.ok) return void toast.error(res.error);
      setConfirming(false);
      toast.success('Apple Health disconnected and its data removed');
      router.refresh();
    });

  const received = status?.summary ? METRIC_GUIDE.filter((m) => status.summary!.metrics[m.metric]) : [];

  return (
    <Card className={cn('relative gap-0 overflow-hidden p-0', status && 'border-primary/25 shadow-[0_20px_60px_-30px_rgba(79,216,230,0.35)]')}>
      {status && <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_0%_0%,rgba(79,216,230,0.10),transparent_60%)]" />}
      <div className="relative flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <SourceLogo id="apple-health" size={56} />
          <div className="flex min-w-[200px] flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="font-display text-xl font-bold">Apple Health</h3>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide',
                  live ? 'bg-good/15 text-good' : status ? 'bg-primary/15 text-primary' : 'bg-white/[0.06] text-muted-foreground',
                )}
              >
                <span className={cn('size-1.5 rounded-full', live ? 'bg-good' : status ? 'bg-primary' : 'bg-muted-foreground')} aria-hidden />
                {live ? 'Connected' : status ? 'Setup in progress' : 'Not connected'}
              </span>
            </div>
            <p className="text-sm text-subtle">Sleep, HRV, steps, weight and nutrition from your iPhone. Replaces the sample recovery and nutrition data.</p>
          </div>
          <div className="w-full sm:w-auto">
            {!status ? (
              <Button onClick={() => openGuide({ method: null, step: 'choose' })} className="h-10 rounded-[10px] px-5 font-semibold">
                <PlugIcon aria-hidden />
                Connect
              </Button>
            ) : !live ? (
              <Button onClick={() => openGuide(resume())} className="h-10 rounded-[10px] px-5 font-semibold">
                <BookOpenIcon aria-hidden />
                Continue setup
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="h-10 rounded-[10px]">
                  <Link href="/sources/apple-health">
                    <TableIcon aria-hidden />
                    View data
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => openGuide({ method: 'export', step: 'export' })} className="h-10 rounded-[10px]">
                  <HistoryIcon aria-hidden />
                  Import history
                </Button>
                <Button variant="outline" onClick={() => openGuide({ method: null, step: 'choose' })} className="h-10 rounded-[10px]">
                  <BookOpenIcon aria-hidden />
                  Setup guide
                </Button>
              </div>
            )}
          </div>
        </div>

        {!status && (
          <ul className="grid gap-2 text-[13px] sm:grid-cols-3" aria-label="Ways to connect">
            {[
              { icon: HistoryIcon, title: 'Import your history', note: 'Free · upload a Health export' },
              { icon: CalendarClockIcon, title: 'Daily with Shortcuts', note: 'Free · automatic each morning' },
              { icon: ZapIcon, title: 'Hourly with Health Auto Export', note: 'Paid app · automatic' },
            ].map((w) => (
              <li key={w.title} className="flex items-center gap-2.5 rounded-[10px] bg-[#141413] px-3 py-2.5">
                <w.icon className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium">{w.title}</span>
                  <span className="block text-xs text-muted-foreground">{w.note}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {status && !live && (
          <p className="text-[13px] text-subtle">
            Your key is ready{status.secretHint ? ` (ending in ${status.secretHint})` : ''}. Finish setting up your iPhone and send a first delivery; the guide shows when it arrives.
          </p>
        )}

        {live && status && (
          <>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-[10px] bg-[#141413] px-3 py-2.5">
                <div className="text-[11px] text-muted-foreground">Last delivery</div>
                <div className="text-sm font-semibold">
                  {ago(status.lastReceivedAt!)}
                  {via && <span className="font-normal text-muted-foreground"> · {via}</span>}
                </div>
              </div>
              <div className="rounded-[10px] bg-[#141413] px-3 py-2.5">
                <div className="text-[11px] text-muted-foreground">Days in it</div>
                <div className="text-sm font-semibold">
                  {status.summary?.days ?? 0}
                  {status.summary?.from && status.summary.to && <span className="font-normal text-muted-foreground"> · {status.summary.from} → {status.summary.to}</span>}
                </div>
              </div>
              <div className="rounded-[10px] bg-[#141413] px-3 py-2.5">
                <div className="text-[11px] text-muted-foreground">Metrics received</div>
                <div className="text-sm font-semibold">
                  {received.length} of {METRIC_GUIDE.length}
                </div>
              </div>
            </div>
            <ul className="flex flex-wrap gap-1.5" aria-label="Metrics">
              {METRIC_GUIDE.map((m) => {
                const ok = !!status.summary?.metrics[m.metric];
                return (
                  <li key={m.metric} className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]', ok ? 'border-good/30 text-good' : 'border-white/10 text-muted-foreground')}>
                    {ok && <CheckIcon className="size-3" aria-hidden />}
                    {m.label}
                  </li>
                );
              })}
            </ul>
            {!!status.summary?.unknown.length && (
              <p className="text-xs text-muted-foreground">
                Also received but not used yet: <code>{status.summary.unknown.join(', ')}</code>
              </p>
            )}
          </>
        )}

        {status?.lastError && (
          <p role="alert" className="flex gap-2 rounded-[10px] border border-bad/40 bg-bad/10 px-3.5 py-2.5 text-[13px]">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
            <span>Last delivery failed: {status.lastError}</span>
          </p>
        )}

        {status && (
          <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
            <div className="grid gap-3 md:grid-cols-2">
              <CopyField label="Endpoint" value={endpoint} />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Key</span>
                <div className="flex items-center justify-between gap-2 rounded-[10px] border border-white/10 bg-[#0f0f0e] py-1 pr-1 pl-3">
                  {status.secretHint ? (
                    <code className="truncate text-[13px] text-muted-foreground">mdah_••••••••{status.secretHint}</code>
                  ) : (
                    <span className="truncate text-[13px] text-muted-foreground">Only needed for daily updates</span>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => openGuide({ method: rememberedMethod() === 'hae' ? 'hae' : 'shortcut', step: 'key' })}>
                    <KeyRoundIcon aria-hidden />
                    {status.secretHint ? 'New key' : 'Create key'}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {confirming ? (
                <>
                  <span className="text-[13px] text-subtle">This stops deliveries and removes the imported Apple Health data.</span>
                  <Button variant="destructive" size="sm" onClick={remove} disabled={pending}>
                    {pending && <Loader2Icon className="animate-spin" aria-hidden />}
                    Disconnect and remove data
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} className="text-subtle">
                  <UnplugIcon aria-hidden />
                  Disconnect
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <AppleHealthSetup
        open={guide.open}
        onOpenChange={(open) => {
          setGuide((g) => ({ ...g, open }));
          if (!open) router.refresh();
        }}
        status={status}
        endpoint={endpoint}
        target={guide.target}
      />
    </Card>
  );
}
