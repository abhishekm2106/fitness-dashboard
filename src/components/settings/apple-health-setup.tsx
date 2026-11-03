'use client';

import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarClockIcon,
  CheckIcon,
  HistoryIcon,
  KeyRoundIcon,
  Loader2Icon,
  PartyPopperIcon,
  RefreshCwIcon,
  SmartphoneIcon,
  WifiIcon,
  ZapIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { appleHealthStatus, issueAppleHealthToken } from '@/app/settings/actions';
import { SourceLogo } from '@/components/sources/source-logo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { HAE_APP, METRIC_GUIDE, type AppleHealthStatus } from '@/lib/apple-health/status';
import { cn } from '@/lib/utils';
import { ExportSteps, UploadStep } from './setup-export';
import { AppCard, ago, CopyField, InApp, isLocal, Path, PhoneMock, Setting, Tip } from './setup-parts';
import { SHORTCUT_NAME, ShortcutRecipe, ShortcutSchedule } from './setup-shortcut';

export type Method = 'export' | 'shortcut' | 'hae';
export type StepId = 'choose' | 'before' | 'install' | 'key' | 'automation' | 'send' | 'test' | 'export' | 'upload' | 'recipe' | 'schedule';
export type GuideTarget = { method: Method | null; step: StepId };

const FLOWS: Record<Method, StepId[]> = {
  export: ['choose', 'export', 'upload'],
  shortcut: ['choose', 'before', 'key', 'recipe', 'schedule', 'test'],
  hae: ['choose', 'before', 'install', 'key', 'automation', 'send', 'test'],
};

const TITLES: Record<StepId, string> = {
  choose: 'Choose how',
  before: 'Before you start',
  install: 'Install and allow access',
  key: 'Create your key',
  automation: 'Add the automation',
  send: 'Choose what to send',
  test: 'Send a test',
  export: 'Export from Health',
  upload: 'Upload the file',
  recipe: 'Build the shortcut',
  schedule: 'Run it every morning',
};

const METHODS: { id: Method; icon: typeof HistoryIcon; title: string; price: string; cadence: string; body: string; effort: string; tag?: string }[] = [
  {
    id: 'export',
    icon: HistoryIcon,
    title: 'Import your history',
    price: 'Free',
    cadence: 'Once, any time',
    body: 'Export everything from the Health app and upload the file. Brings in years of sleep, steps and weight at once.',
    effort: 'About 3 minutes',
    tag: 'Start here',
  },
  {
    id: 'shortcut',
    icon: CalendarClockIcon,
    title: 'Daily updates with Shortcuts',
    price: 'Free',
    cadence: 'Automatic, every morning',
    body: "Build one shortcut in Apple's Shortcuts app that sends yesterday's data each morning.",
    effort: 'About 15 minutes, once',
    tag: 'Then this',
  },
  {
    id: 'hae',
    icon: ZapIcon,
    title: 'Hourly with Health Auto Export',
    price: 'Paid app',
    cadence: 'Automatic, every hour',
    body: `The ${HAE_APP.name} app sends your data in the background. Quickest to set up; needs its Premium plan.`,
    effort: 'About 5 minutes',
  },
];

const METHOD_KEY = 'md.appleHealth.method';
export const rememberedMethod = (): Method | null => {
  try {
    const m = localStorage.getItem(METHOD_KEY);
    return m === 'export' || m === 'shortcut' || m === 'hae' ? m : null;
  } catch {
    return null;
  }
};
const remember = (m: Method) => {
  try {
    localStorage.setItem(METHOD_KEY, m);
  } catch {
    // only a convenience
  }
};

export function AppleHealthSetup({
  open,
  onOpenChange,
  status,
  endpoint,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: AppleHealthStatus | null;
  endpoint: string;
  target: GuideTarget;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<Method | null>(target.method);
  const [step, setStep] = useState<StepId>(target.step);
  const [token, setToken] = useState<string | null>(null);
  const [tunnel, setTunnel] = useState('');
  const [live, setLive] = useState<AppleHealthStatus | null>(status);
  const [pending, start] = useTransition();
  const openedAt = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      openedAt.current = Date.now();
      setMethod(target.method);
      setStep(target.step);
      setLive(status);
    }
    // only when the guide opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [step]);

  // On the test step, watch for the phone's delivery
  useEffect(() => {
    if (!open || step !== 'test') return;
    let stop = false;
    const tick = async () => {
      const s = await appleHealthStatus().catch(() => null);
      if (!stop) setLive(s);
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [open, step]);

  const flow = method ? FLOWS[method] : (['choose'] as StepId[]);
  const index = Math.max(0, flow.indexOf(step));
  const base = /^https:\/\/[^\s/]+/i.test(tunnel.trim()) ? tunnel.trim().replace(/\/+$/, '') : null;
  const url = base ? `${base}/api/ingest/apple-health` : endpoint;
  const local = isLocal(url);
  const hint = live?.secretHint ?? status?.secretHint ?? null;
  const header = token ? `Bearer ${token}` : null;
  const hasKey = !!token || !!hint;
  const arrived = live?.lastReceivedAt && Date.parse(live.lastReceivedAt) >= openedAt.current - 1000 ? live : null;
  const metrics = arrived?.summary?.metrics ?? {};

  const choose = (m: Method) => {
    remember(m);
    setMethod(m);
    setStep(FLOWS[m][1]);
  };
  const go = (to: number) => setStep(flow[Math.min(flow.length - 1, Math.max(0, to))]);
  const createKey = () =>
    start(async () => {
      const res = await issueAppleHealthToken();
      if (!res.ok) return void toast.error(res.error);
      setToken(res.token);
      router.refresh();
    });

  const last = index === flow.length - 1;
  const canNext = step !== 'choose' && (step !== 'key' || hasKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-24px)] max-w-[940px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[940px]">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4 pr-12">
          <SourceLogo id="apple-health" size={36} />
          <div className="min-w-0">
            <DialogTitle className="font-display text-lg">Connect Apple Health</DialogTitle>
            <DialogDescription className="text-xs">
              {method ? METHODS.find((m) => m.id === method)!.title : 'Three ways to get your iPhone’s Health data here'}. You can close this and come back any time.
            </DialogDescription>
          </div>
        </div>

        {/* progress on small screens */}
        <div className="border-b border-white/10 px-5 py-3 md:hidden">
          <div className="flex justify-between gap-3 text-xs text-muted-foreground">
            <span className="shrink-0">{method ? `Step ${index + 1} of ${flow.length}` : 'Start'}</span>
            <span className="truncate font-medium text-foreground">{TITLES[step]}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded bg-track">
            <div className="h-full rounded bg-primary transition-all" style={{ width: `${((index + 1) / (method ? flow.length : 4)) * 100}%` }} />
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav aria-label="Setup steps" className="hidden w-[220px] shrink-0 border-r border-white/10 p-3 md:block">
            <ol className="flex flex-col gap-1">
              {flow.map((id, i) => {
                const done = i < index || (id === 'test' && !!arrived);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setStep(id)}
                      aria-current={id === step ? 'step' : undefined}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] transition-colors',
                        id === step ? 'bg-white/[0.07] font-semibold text-foreground' : 'text-subtle hover:bg-white/[0.04] hover:text-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                          done ? 'bg-good/20 text-good' : id === step ? 'bg-primary text-primary-foreground' : 'bg-white/[0.07] text-muted-foreground',
                        )}
                      >
                        {done ? <CheckIcon className="size-3.5" aria-hidden /> : i + 1}
                      </span>
                      {TITLES[id]}
                    </button>
                  </li>
                );
              })}
            </ol>
            {!method && <p className="mt-3 px-2.5 text-xs text-muted-foreground">Pick a way to see its steps.</p>}
          </nav>

          <div ref={scroller} className="min-w-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
            <h3 className="hidden font-display text-xl font-bold md:block">{step === 'choose' ? 'How should your data get here?' : TITLES[step]}</h3>

            {step === 'choose' && (
              <div className="mt-1 flex flex-col gap-4">
                <p className="text-sm text-subtle">
                  Apple doesn&apos;t let websites read Health data directly, so your iPhone sends it. Pick one, or combine them: most people import their history once, then add
                  daily updates.
                </p>
                <div className="grid gap-3">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => choose(m.id)}
                      className={cn(
                        'group flex gap-4 rounded-[14px] border p-4 text-left transition-colors hover:border-primary/60 hover:bg-primary/[0.05] focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:outline-none',
                        method === m.id ? 'border-primary/60 bg-primary/[0.05]' : 'border-white/10',
                      )}
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                        <m.icon className="size-5" aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <b className="text-[15px]">{m.title}</b>
                          {m.tag && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">{m.tag}</span>}
                        </span>
                        <span className="text-[13px] text-subtle">{m.body}</span>
                        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                          <span className={cn('font-semibold', m.price === 'Free' ? 'text-good' : 'text-[#f0b445]')}>{m.price}</span>
                          <span className="text-muted-foreground">{m.cadence}</span>
                          <span className="text-muted-foreground">{m.effort}</span>
                        </span>
                      </span>
                      <ArrowRightIcon className="mt-3 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'export' && <ExportSteps />}
            {step === 'upload' && <UploadStep onShortcuts={() => choose('shortcut')} />}

            {step === 'before' && (
              <div className="mt-1 flex flex-col gap-5">
                {method === 'hae' ? (
                  <>
                    <p className="text-sm text-subtle">Two apps are involved:</p>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <div className="rounded-[12px] border border-white/10 p-3.5">
                        <div className="text-sm font-semibold">Apple Health</div>
                        <div className="text-[13px] text-subtle">The app already on your iPhone, where your data lives. Nothing to set up there.</div>
                      </div>
                      <div className="rounded-[12px] border border-primary/30 bg-primary/[0.06] p-3.5">
                        <div className="text-sm font-semibold">{HAE_APP.name}</div>
                        <div className="text-[13px] text-subtle">A separate App Store app that reads Health and sends it here every hour. This is the one you set up.</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-subtle">
                    This uses <b className="text-foreground">Shortcuts</b>, Apple&apos;s free automation app that&apos;s already on your iPhone (search for it if it isn&apos;t on
                    your home screen). You build one shortcut, and an automation runs it every morning.
                  </p>
                )}
                <ul className="flex flex-col gap-3">
                  {[
                    { icon: SmartphoneIcon, title: 'An iPhone with Health data', body: 'Sleep and HRV come from an Apple Watch or sleep app, steps from the phone, weight from a smart scale, food from apps like MyFitnessPal or Cronometer.' },
                    ...(method === 'hae'
                      ? [{ icon: KeyRoundIcon, title: HAE_APP.name, body: `By ${HAE_APP.developer}. Free to download; automatic exports are part of its Premium plan.` }]
                      : [{ icon: CalendarClockIcon, title: 'iOS 17 or later', body: 'So the morning automation can run without asking you to tap.' }]),
                    { icon: WifiIcon, title: 'A dashboard your phone can reach', body: 'The phone posts to this dashboard over the internet, so it needs a public HTTPS address.' },
                  ].map((r) => (
                    <li key={r.title} className="flex gap-3 rounded-[12px] border border-white/10 p-3.5">
                      <r.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                      <div>
                        <div className="text-sm font-semibold">{r.title}</div>
                        <div className="text-[13px] text-subtle">{r.body}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                {isLocal(endpoint) ? (
                  <div className="flex flex-col gap-3">
                    <Tip tone="warn">
                      This dashboard is running on your computer (<code>localhost</code>), which your phone can&apos;t reach. Finish setup on your deployed dashboard, or, to test
                      now, run an HTTPS tunnel such as Cloudflare Tunnel and paste its address here.
                    </Tip>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium">Tunnel or deployed address (optional)</span>
                      <Input value={tunnel} onChange={(e) => setTunnel(e.target.value)} placeholder="https://your-name.trycloudflare.com" className="h-10 rounded-[10px]" inputMode="url" />
                      <span className="text-xs text-muted-foreground">{base ? `Your phone will post to ${url}` : 'Must start with https://. Leave empty to set this up later.'}</span>
                    </label>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-[13px] text-good">
                    <CheckIcon className="size-4" aria-hidden />
                    Your phone can reach this dashboard at {new URL(endpoint).host}.
                  </p>
                )}
              </div>
            )}

            {step === 'install' && (
              <div className="mt-1 flex flex-col gap-5">
                <ol className="flex flex-col gap-4 text-sm">
                  <li className="flex flex-col gap-3">
                    <b>1. Install it on your iPhone</b>
                    <AppCard qr />
                    <span className="text-xs text-muted-foreground">
                      Or search the App Store for &ldquo;Health Auto Export&rdquo; and look for that name and developer. It&apos;s not Apple&apos;s Health app.
                    </span>
                  </li>
                  <li className="flex flex-col gap-2">
                    <b>2. Open Health Auto Export and allow Health access</b>
                    <span className="text-subtle">iOS asks which data the app may read. Turn on these, or tap Turn On All:</span>
                  </li>
                </ol>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {METRIC_GUIDE.map((m) => (
                    <li key={m.metric} className="flex gap-2.5 rounded-[10px] bg-[#141413] px-3 py-2">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold">{m.app}</div>
                        <div className="text-xs text-muted-foreground">{m.powers}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <Tip>
                  Missed one? Change it later in the iPhone&apos;s <b>Settings → Health → Data Access &amp; Devices → Health Auto Export</b>.
                </Tip>
              </div>
            )}

            {step === 'key' && (
              <div className="mt-1 flex flex-col gap-5">
                <p className="text-sm text-subtle">
                  The key proves that deliveries come from your phone. It&apos;s shown only once, and the dashboard keeps just a fingerprint of it, so copy it somewhere you can paste
                  from on your iPhone. It goes in {method === 'shortcut' ? 'the shortcut’s Get Contents of URL header' : 'the automation’s HTTP header'}.
                </p>
                {token ? (
                  <div className="flex flex-col gap-3">
                    <CopyField label="Header name" value="Authorization" />
                    <CopyField label="Header value" value={`Bearer ${token}`} secret hint="Paste this whole line, including the word Bearer." />
                    <Tip tone="warn">Copy it now. When you close this guide, the key can&apos;t be shown again; you can always create a new one.</Tip>
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-3 rounded-[12px] border border-white/10 p-4">
                    {hint && (
                      <p className="text-[13px] text-subtle">
                        You already have a key ending in <code className="text-foreground">{hint}</code>. If it&apos;s set up on your phone already, skip ahead. Creating a new one
                        stops the old one working.
                      </p>
                    )}
                    <Button onClick={createKey} disabled={pending} className="h-10 rounded-[10px] px-5 font-semibold">
                      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <KeyRoundIcon aria-hidden />}
                      {hint ? 'Create a new key' : 'Create my key'}
                    </Button>
                  </div>
                )}
                <Tip>
                  Getting it onto your phone: with the same Apple ID, copying on a Mac pastes on the iPhone (Universal Clipboard). Otherwise paste it into a note that syncs, or
                  open this page on your phone.
                </Tip>
              </div>
            )}

            {step === 'recipe' && <ShortcutRecipe url={url} header={header} />}
            {step === 'schedule' && <ShortcutSchedule />}

            {step === 'automation' && (
              <div className="mt-1 flex flex-col gap-6 sm:flex-row-reverse sm:items-start">
                <PhoneMock
                  title="New REST API automation"
                  rows={[
                    { label: 'Name', value: 'Master Dashboard', on: true },
                    { label: 'URL', value: url.replace(/^https?:\/\//, ''), on: true },
                    { label: 'HTTP Headers', value: 'Authorization', on: true },
                    { label: 'Data Type', value: 'Health Metrics' },
                    { label: 'Export Format', value: 'JSON' },
                  ]}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-2.5 rounded-[12px] border border-white/10 p-3.5">
                    <InApp>In Health Auto Export</InApp>
                    <Path steps={['Export', 'Automated', 'New Automation']} />
                    <span className="text-[13px] text-subtle">
                      Open the app&apos;s <b className="text-foreground">Export</b> screen, choose <b className="text-foreground">Automated</b>, then tap{' '}
                      <b className="text-foreground">New Automation</b>. For the destination, pick <b className="text-foreground">REST API</b>.
                    </span>
                  </div>
                  <span className="text-sm text-subtle">Then fill in:</span>
                  <CopyField label="Name (anything you like)" value="Master Dashboard" />
                  <CopyField label="URL" value={url} />
                  {local && <span className="-mt-2 text-xs text-[#c98500]">This is a local address. Add a tunnel or deployed address in step 2 first.</span>}
                  <div className="flex flex-col gap-3 rounded-[12px] border border-white/10 p-3.5">
                    <span className="text-sm">
                      Under <b>HTTP Headers</b>, tap add and enter:
                    </span>
                    <CopyField label="Key" value="Authorization" />
                    {header ? (
                      <CopyField label="Value" value={header} secret />
                    ) : (
                      <p className="text-[13px] text-subtle">
                        Value: <code className="text-foreground">Bearer</code> followed by your key{hint ? ` (ending in ${hint})` : ''}.{' '}
                        <button type="button" onClick={() => setStep('key')} className="font-medium text-primary hover:underline">
                          {hasKey ? 'Need a new key?' : 'Create your key first'}
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 'send' && (
              <div className="mt-1 flex flex-col gap-6 sm:flex-row-reverse sm:items-start">
                <PhoneMock
                  title="Automation settings"
                  rows={[
                    { label: 'Data Type', value: 'Health Metrics', on: true },
                    { label: 'Export Format', value: 'JSON', on: true },
                    { label: 'Summarize Data', value: 'On', on: true },
                    { label: 'Time Grouping', value: 'Days', on: true },
                    { label: 'Date Range', value: 'Previous 7 Days', on: true },
                    { label: 'Batch Requests', value: 'On', on: true },
                    { label: 'Sync Frequency', value: 'Every hour', on: true },
                  ]}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <InApp>In Health Auto Export, in the same automation</InApp>
                  <ul className="divide-y divide-white/[0.06]">
                    <Setting name="Data Type" value="Health Metrics" why="Sleep, HRV, steps, weight and nutrition. (Workouts already come from Hevy.)" />
                    <Setting name="Export Format" value="JSON" why="The format the dashboard reads." />
                    <Setting name="Summarize Data" value="On" why="Sends one total per day instead of every single reading." />
                    <Setting name="Time Grouping" value="Days" why="Matches the dashboard's daily view." />
                    <Setting name="Date Range" value="Previous 7 Days" why="Re-sends the last week each time, so late data (like last night's sleep) is never missed. Days are replaced, not added twice." />
                    <Setting name="Batch Requests" value="On" why="Splits big uploads into smaller requests." />
                    <Setting name="Sync Frequency" value="1 hour" why="iOS treats this as a target, not a guarantee; opening the app now and then helps." />
                  </ul>
                  <div>
                    <div className="mb-2 text-sm font-medium">In the same automation, select these metrics:</div>
                    <ul className="flex flex-wrap gap-1.5">
                      {METRIC_GUIDE.map((m) => (
                        <li key={m.metric} className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-subtle">
                          {m.app}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Tip>
                    Finally turn on <b className="text-foreground">Enabled</b> and tap <b className="text-foreground">Update</b> to save the automation.
                  </Tip>
                </div>
              </div>
            )}

            {step === 'test' && (
              <div className="mt-1 flex flex-col gap-5">
                {method === 'shortcut' ? (
                  <div className="flex flex-col gap-2.5 rounded-[12px] border border-white/10 p-3.5">
                    <InApp>In Shortcuts</InApp>
                    <span className="text-[13px] text-subtle">
                      Tap <b className="text-foreground">{SHORTCUT_NAME}</b> once to run it now, and allow access when asked. It sends yesterday&apos;s data and last night&apos;s
                      sleep.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2.5 rounded-[12px] border border-white/10 p-3.5">
                      <InApp>In Health Auto Export, in the automation you just saved</InApp>
                      <Path steps={['Export Existing Data', 'Manual Upload', 'Begin Export']} />
                      <span className="text-[13px] text-subtle">
                        Under <b className="text-foreground">Export Existing Data</b>, choose <b className="text-foreground">Manual Upload</b>. Set{' '}
                        <b className="text-foreground">Start</b> to about 3 months ago and <b className="text-foreground">End</b> to today, then tap{' '}
                        <b className="text-foreground">Begin Export</b>.
                      </span>
                    </div>
                    <p className="text-[13px] text-subtle">
                      After that it runs on its own every hour. To trigger it any time, use the app&apos;s Automations widget (the cloud button) or the Shortcuts action{' '}
                      <b className="text-foreground">Run Automation</b>.
                    </p>
                  </>
                )}
                <p className="text-[13px] text-subtle">Keep this page open: it checks for the delivery every few seconds.</p>

                <div
                  role="status"
                  aria-live="polite"
                  className={cn('flex flex-col gap-3 rounded-[14px] border p-4', arrived ? 'border-good/40 bg-good/[0.08]' : 'border-white/10 bg-[#141413]')}
                >
                  {arrived ? (
                    <>
                      <div className="flex items-center gap-2.5">
                        <PartyPopperIcon className="size-5 text-good" aria-hidden />
                        <b>Connected! Your phone&apos;s data has arrived.</b>
                      </div>
                      <p className="text-[13px] text-subtle">
                        {arrived.summary?.days ?? 0} {arrived.summary?.days === 1 ? 'day' : 'days'}
                        {arrived.summary?.from && arrived.summary.to ? ` (${arrived.summary.from}${arrived.summary.to !== arrived.summary.from ? ` to ${arrived.summary.to}` : ''})` : ''}.
                        The dashboard now uses it instead of sample data.
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {METRIC_GUIDE.map((m) => {
                          const ok = !!metrics[m.metric];
                          return (
                            <li key={m.metric} className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]', ok ? 'border-good/30 text-good' : 'border-white/10 text-muted-foreground')}>
                              {ok && <CheckIcon className="size-3" aria-hidden />}
                              {m.label}
                            </li>
                          );
                        })}
                      </ul>
                      {!!arrived.summary?.unknown.length && (
                        <p className="text-xs text-[#f0b445]">
                          Not recognised: <code>{arrived.summary.unknown.join(', ')}</code>. Check those key names against the table in the recipe.
                        </p>
                      )}
                      {METRIC_GUIDE.some((m) => !metrics[m.metric]) && (
                        <p className="text-xs text-muted-foreground">Grey ones weren&apos;t in this delivery. That&apos;s fine if you don&apos;t track them.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5">
                        <Loader2Icon className="size-5 animate-spin text-primary" aria-hidden />
                        <b>Waiting for your phone…</b>
                      </div>
                      <p className="text-[13px] text-subtle">
                        {live?.lastReceivedAt ? `The last delivery was ${ago(live.lastReceivedAt)}. Run it again to see it arrive here.` : 'Nothing has arrived yet.'}
                      </p>
                      {live?.lastError && (
                        <p className="flex gap-2 text-[13px] text-bad">
                          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                          Last attempt failed: {live.lastError}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {!arrived && (
                  <details className="group rounded-[12px] border border-white/10 px-4 py-3 text-[13px]">
                    <summary className="cursor-pointer font-medium text-subtle group-open:text-foreground">Nothing arriving? Common fixes</summary>
                    <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-subtle">
                      <li>Rejected or unauthorised: the header value must be exactly <code>Bearer</code>, a space, then your key. Create a new key if unsure.</li>
                      <li>Times out or can&apos;t connect: the URL must be your public <code>https://</code> address, not localhost, and the phone needs internet.</li>
                      {method === 'shortcut' ? (
                        <>
                          <li>
                            Values missing: check Shortcuts may read Health in <b>Settings → Privacy &amp; Security → Health → Shortcuts</b>, and that the JSON keys match the
                            recipe exactly.
                          </li>
                          <li>An error about the body: set Request Body to JSON, and make <code>date</code> a Text field formatted yyyy-MM-dd.</li>
                        </>
                      ) : (
                        <>
                          <li>Nothing at all: check the automation&apos;s <b>Enabled</b> switch is on and you tapped <b>Update</b>.</li>
                          <li>Some metrics missing: allow them in Health access and select them in the automation&apos;s metrics list.</li>
                          <li>Hourly runs stop: iOS limits background work. Open Health Auto Export now and then, and keep Background App Refresh on for it.</li>
                        </>
                      )}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3.5">
          <Button variant="ghost" onClick={() => (index === 0 ? undefined : go(index - 1))} disabled={step === 'choose'}>
            <ArrowLeftIcon aria-hidden />
            {index === 1 ? 'Other ways' : 'Back'}
          </Button>
          <div className="flex items-center gap-2">
            {step === 'test' && !arrived && (
              <Button variant="ghost" onClick={async () => setLive(await appleHealthStatus())} className="text-subtle">
                <RefreshCwIcon aria-hidden />
                Check now
              </Button>
            )}
            {step === 'choose' ? (
              <span className="text-xs text-muted-foreground">Choose one to continue</span>
            ) : last ? (
              <Button onClick={() => onOpenChange(false)} className="h-10 rounded-[10px] px-5 font-semibold">
                {arrived || step === 'upload' ? 'Done' : 'Finish later'}
              </Button>
            ) : (
              <Button onClick={() => go(index + 1)} disabled={!canNext} className="h-10 rounded-[10px] px-5 font-semibold">
                {step === 'key' && !hasKey ? 'Create a key to continue' : 'Next'}
                <ArrowRightIcon aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
