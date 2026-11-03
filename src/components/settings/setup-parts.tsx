'use client';

import { AlertTriangleIcon, ArrowRightIcon, CheckIcon, CopyIcon, ExternalLinkIcon, SmartphoneIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { HAE_APP, HAE_APP_STORE } from '@/lib/apple-health/status';
import { cn } from '@/lib/utils';

// Building blocks shared by the Apple Health setup guide's steps

export const isLocal = (url: string) => /\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(url);

export function ago(at: string): string {
  const m = Math.round((Date.now() - Date.parse(at)) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

export function CopyField({ label, value, secret, hint }: { label: string; value: string; secret?: boolean; hint?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</span>
      <div className="flex min-w-0 items-center gap-2 rounded-[10px] border border-white/10 bg-[#0f0f0e] py-1 pr-1 pl-3">
        <code className={cn('min-w-0 flex-1 truncate text-[13px]', secret && 'text-primary')} title={value}>
          {value}
        </code>
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
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** A schematic of an app screen: which field gets which value. Not a screenshot. */
export function PhoneMock({ title, rows }: { title: string; rows: { label: string; value: string; on?: boolean }[] }) {
  return (
    <div aria-hidden className="mx-auto w-[230px] shrink-0 rounded-[30px] border border-white/15 bg-[#0b0b0c] p-2.5 shadow-[0_20px_50px_-25px_rgba(79,216,230,0.45)]">
      <div className="mx-auto mb-2 h-4 w-20 rounded-full bg-black" />
      <div className="rounded-[20px] bg-[#1c1c1e] px-3 pt-3 pb-4">
        <div className="mb-2.5 text-center text-[13px] font-semibold text-white">{title}</div>
        <div className="divide-y divide-white/[0.06] overflow-hidden rounded-xl bg-[#2c2c2e]">
          {rows.map((r) => (
            <div key={r.label} className={cn('flex items-center justify-between gap-2 px-2.5 py-2 text-[11px]', r.on && 'bg-primary/15 ring-1 ring-primary/60 ring-inset')}>
              <span className="text-white/85">{r.label}</span>
              <span className={cn('max-w-[110px] truncate text-right', r.on ? 'font-semibold text-primary' : 'text-white/45')}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Setting({ name, value, why }: { name: string; value: string; why: string }) {
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 py-2.5">
      <span className="text-sm font-medium">{name}</span>
      <span className="rounded-md bg-primary/15 px-2 py-0.5 text-right text-[13px] font-semibold text-primary">{value}</span>
      <span className="col-span-2 text-xs text-muted-foreground">{why}</span>
    </li>
  );
}

export function Tip({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <p className={cn('flex gap-2 rounded-[10px] border px-3.5 py-2.5 text-[13px] text-subtle', tone === 'warn' ? 'border-[#c98500]/40 bg-[#c98500]/10' : 'border-primary/25 bg-primary/[0.07]')}>
      {tone === 'warn' ? <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-[#c98500]" aria-hidden /> : <SmartphoneIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />}
      <span>{children}</span>
    </p>
  );
}

/** Which app an instruction happens in */
export function InApp({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[11px] font-semibold text-subtle">
      <SmartphoneIcon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

/** Where to tap, using the app's own labels */
export function Path({ steps }: { steps: string[] }) {
  return (
    <ol aria-label="Where to tap" className="flex flex-wrap items-center gap-1.5 text-[13px]">
      {steps.map((x, i) => (
        <li key={x} className="flex items-center gap-1.5">
          {i > 0 && <ArrowRightIcon className="size-3.5 text-muted-foreground" aria-hidden />}
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-semibold text-primary">{x}</span>
        </li>
      ))}
    </ol>
  );
}

/** A titled group of instructions inside a step */
export function Block({ title, app, children }: { title: string; app?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-[12px] border border-white/10 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        {app && <InApp>{app}</InApp>}
      </div>
      {children}
    </section>
  );
}

/** Exactly which App Store app to get, with a QR code to open it on the phone */
export function AppCard({ qr }: { qr?: boolean }) {
  return (
    <div className="flex flex-col gap-4 rounded-[14px] border border-primary/30 bg-primary/[0.06] p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[11px] font-semibold tracking-wider text-primary uppercase">The app to install</span>
        <b className="text-base">{HAE_APP.name}</b>
        <span className="text-[13px] text-subtle">
          by {HAE_APP.developer} · &ldquo;{HAE_APP.subtitle}&rdquo;
        </span>
        <span className="text-xs text-muted-foreground">Free to download. Automatic exports to your dashboard are part of its Premium plan; prices show in the App Store.</span>
        <Button asChild variant="outline" size="sm" className="mt-2 w-fit rounded-[10px]">
          <a href={HAE_APP_STORE} target="_blank" rel="noreferrer">
            Open in the App Store
            <ExternalLinkIcon aria-hidden />
          </a>
        </Button>
      </div>
      {qr && (
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <div className="rounded-xl bg-white p-2.5">
            <QRCodeSVG value={HAE_APP_STORE} size={112} level="M" aria-label="QR code for the app's App Store page" />
          </div>
          <span className="text-center text-[11px] text-muted-foreground">Scan with your iPhone camera</span>
        </div>
      )}
    </div>
  );
}
