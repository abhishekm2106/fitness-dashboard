'use client';

import { AlertTriangleIcon, CheckIcon, ChevronDownIcon, CopyIcon, KeyRoundIcon, Loader2Icon, RefreshCwIcon, UnplugIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { disconnectAppleHealth, issueAppleHealthToken } from '@/app/settings/actions';
import { SourceLogo } from '@/components/sources/source-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Metric } from '@/lib/apple-health/parse';
import { cn } from '@/lib/utils';

export interface AppleHealthStatus {
  connectedAt: string;
  lastReceivedAt: string | null;
  summary: { days: number; from: string | null; to: string | null; metrics: Partial<Record<Metric, number>>; unknown: string[] } | null;
  lastError: string | null;
  secretHint: string | null;
}

const LABELS: [Metric, string][] = [
  ['sleep_h', 'Sleep'],
  ['hrv_ms', 'HRV'],
  ['resting_hr', 'Resting HR'],
  ['steps', 'Steps'],
  ['active_kcal', 'Active energy'],
  ['weight_kg', 'Weight'],
  ['body_fat_pct', 'Body fat'],
  ['kcal', 'Calories'],
  ['protein_g', 'Protein'],
  ['carbs_g', 'Carbs'],
  ['fat_g', 'Fat'],
];

// The Health Auto Export metrics to tick; nutrition arrives here when MyFitnessPal or Cronometer writes to Health
const PICK = 'Sleep Analysis, Heart Rate Variability, Resting Heart Rate, Step Count, Active Energy, Weight & Body Mass, Body Fat Percentage, Dietary Energy, Protein, Carbohydrates, Total Fat';

function ago(at: string): string {
  const m = Math.round((Date.now() - Date.parse(at)) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

function Copy({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</span>
      <div className="flex min-w-0 items-center gap-2 rounded-[10px] border border-white/10 bg-[#0f0f0e] py-1 pr-1 pl-3">
        <code className={cn('min-w-0 flex-1 truncate text-[13px]', secret && 'text-primary')}>{value}</code>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          }}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {done ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
          {done ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

function Steps({ token, hint }: { token: string | null; hint: string | null }) {
  const header = token ? `Bearer ${token}` : `Bearer mdah_••••${hint ?? ''}`;
  const rows: [string, React.ReactNode][] = [
    ['Install', <>Get <b>Health Auto Export</b> on your iPhone and allow it to read Health data. Automations need its premium unlock.</>],
    ['New automation', <>Open <b>Automations</b>, tap <b>+</b>, choose <b>REST API</b>.</>],
    ['URL', <>Paste the endpoint address above.</>],
    ['Header', <>Under <b>HTTP Headers</b> add key <code>Authorization</code> with value <code className="break-all">{header}</code>.</>],
    ['Data', <>Data Type <b>Health Metrics</b>, and pick: {PICK}.</>],
    ['Format', <>Export Format <b>JSON</b>, <b>Summarize Data</b> on, Time Grouping <b>Days</b>, Date Range <b>Previous 7 Days</b>, <b>Batch Requests</b> on.</>],
    ['Schedule', <>Sync Frequency <b>1 hour</b>. For older history, run a <b>Manual Upload</b> once with a longer range.</>],
  ];
  return (
    <ol className="flex flex-col gap-2.5">
      {rows.map(([title, body], i) => (
        <li key={title} className="flex gap-3 text-[13px] leading-relaxed">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/[0.07] text-xs font-semibold text-subtle">{i + 1}</span>
          <span className="text-subtle">
            <b className="text-foreground">{title}.</b> {body}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function AppleHealthCard({ status, endpoint }: { status: AppleHealthStatus | null; endpoint: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [pending, start] = useTransition();
  const local = /\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(endpoint);

  const issue = () =>
    start(async () => {
      const res = await issueAppleHealthToken();
      if (!res.ok) return void toast.error(res.error);
      setToken(res.token);
      setShowSteps(true);
      router.refresh();
    });
  const remove = () =>
    start(async () => {
      const res = await disconnectAppleHealth();
      if (!res.ok) return void toast.error(res.error);
      setToken(null);
      setConfirming(false);
      toast.success('Apple Health disconnected and its data removed');
      router.refresh();
    });

  const received = status?.summary ? LABELS.filter(([m]) => status.summary!.metrics[m]) : [];
  const live = !!status?.lastReceivedAt;

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
                {live ? 'Connected' : status ? 'Waiting for first delivery' : 'Not connected'}
              </span>
            </div>
            <p className="text-sm text-subtle">
              Sleep, HRV, steps, weight and nutrition from your iPhone, sent by the Health Auto Export app. Replaces the sample recovery and nutrition data.
            </p>
          </div>
          {!status && (
            <div className="w-full sm:w-auto">
              <Button onClick={issue} disabled={pending} className="h-10 rounded-[10px] px-5 font-semibold">
                {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <KeyRoundIcon aria-hidden />}
                Connect
              </Button>
            </div>
          )}
        </div>

        {status && (
          <>
            {live && (
              <div className="grid gap-2.5 sm:grid-cols-3">
                <div className="rounded-[10px] bg-[#141413] px-3 py-2.5">
                  <div className="text-[11px] text-muted-foreground">Last delivery</div>
                  <div className="text-sm font-semibold">{ago(status.lastReceivedAt!)}</div>
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
                    {received.length} of {LABELS.length}
                  </div>
                </div>
              </div>
            )}
            {live && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Metrics">
                {LABELS.map(([m, label]) => {
                  const ok = !!status.summary?.metrics[m];
                  return (
                    <li key={m} className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]', ok ? 'border-good/30 text-good' : 'border-white/10 text-muted-foreground')}>
                      {ok && <CheckIcon className="size-3" aria-hidden />}
                      {label}
                    </li>
                  );
                })}
              </ul>
            )}
            {status.lastError && (
              <p role="alert" className="flex gap-2 rounded-[10px] border border-bad/40 bg-bad/10 px-3.5 py-2.5 text-[13px]">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
                <span>Last delivery failed: {status.lastError}</span>
              </p>
            )}
            {!!status.summary?.unknown.length && (
              <p className="text-xs text-muted-foreground">
                Also received but not used yet: <code>{status.summary.unknown.join(', ')}</code>
              </p>
            )}

            <div className="flex flex-col gap-3 rounded-[12px] border border-white/10 p-4">
              {local && (
                <p className="flex gap-2 text-[13px] text-subtle">
                  <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-[#c98500]" aria-hidden />
                  <span>
                    This address is on your computer, so your phone can&apos;t reach it. Use your deployed address instead, or an HTTPS tunnel such as Cloudflare Tunnel while testing.
                  </span>
                </p>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <Copy label="Endpoint" value={endpoint} />
                {token ? (
                  <Copy label="Authorization header" value={`Bearer ${token}`} secret />
                ) : (
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Token</span>
                    <div className="flex items-center justify-between gap-2 rounded-[10px] border border-white/10 bg-[#0f0f0e] py-1 pr-1 pl-3">
                      <code className="text-[13px] text-muted-foreground">mdah_••••••••{status.secretHint}</code>
                      <Button type="button" variant="ghost" size="sm" onClick={issue} disabled={pending}>
                        <RefreshCwIcon className={pending ? 'animate-spin' : undefined} aria-hidden />
                        New token
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {token && (
                <p className="text-xs text-bad">Copy the header now: the token is shown only once. The old token, if any, has stopped working.</p>
              )}
              <button type="button" onClick={() => setShowSteps((s) => !s)} aria-expanded={showSteps} className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <ChevronDownIcon className={cn('size-4 transition-transform', showSteps && 'rotate-180')} aria-hidden />
                {showSteps ? 'Hide setup steps' : 'Show setup steps'}
              </button>
              {showSteps && <Steps token={token} hint={status.secretHint} />}
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
          </>
        )}
      </div>
    </Card>
  );
}
