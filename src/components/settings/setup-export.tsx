'use client';

import { CheckIcon, FileArchiveIcon, Loader2Icon, PartyPopperIcon, UploadIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { importAppleHealthExport } from '@/app/settings/actions';
import { Button } from '@/components/ui/button';
import type { ParsedValue, ParseSummary } from '@/lib/apple-health/parse';
import { METRIC_GUIDE } from '@/lib/apple-health/status';
import { cn } from '@/lib/utils';
import type { WorkerMessage } from './health-export.worker';
import { Block, Path, Tip } from './setup-parts';

/** Step: how to get the export file out of the Health app */
export function ExportSteps() {
  return (
    <div className="mt-1 flex flex-col gap-4">
      <p className="text-sm text-subtle">
        Apple Health can export everything it has ever recorded into one file. This brings in your full history in one go: no app to install, nothing to pay.
      </p>
      <Block title="1. Export from Health" app="In Apple Health">
        <Path steps={['Your profile picture', 'Export All Health Data', 'Export']} />
        <span className="text-[13px] text-subtle">
          Open the <b className="text-foreground">Health</b> app, tap your <b className="text-foreground">profile picture</b> (top right), scroll down to{' '}
          <b className="text-foreground">Export All Health Data</b> and confirm <b className="text-foreground">Export</b>. Preparing it can take a few minutes if you have years of
          data.
        </span>
      </Block>
      <Block title="2. Get the file onto this computer">
        <span className="text-[13px] text-subtle">When the share sheet appears, send the file the easiest way for you:</span>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-subtle">
          <li>
            <b className="text-foreground">AirDrop</b> it to your Mac (it lands in Downloads).
          </li>
          <li>
            <b className="text-foreground">Save to Files</b> in iCloud Drive or Google Drive, then download it here.
          </li>
          <li>Or open this page on your iPhone and upload it straight from Files.</li>
        </ul>
        <span className="text-[13px] text-subtle">
          The file is called <code className="text-foreground">export.zip</code>. Keep it zipped; the next step reads it as is.
        </span>
      </Block>
      <Tip>The export contains everything in Health, but this dashboard only keeps daily totals of the 11 metrics it uses. The rest of the file never leaves your computer.</Tip>
    </div>
  );
}

type Phase = { kind: 'idle' } | { kind: 'reading'; pct: number } | { kind: 'saving'; done: number; total: number } | { kind: 'done'; summary: ParseSummary } | { kind: 'error'; message: string };

const CHUNK = 2000;

/** Step: drop the file; it's read in a background worker and only daily totals are sent */
export function UploadStep({ onShortcuts }: { onShortcuts: () => void }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = phase.kind === 'reading' || phase.kind === 'saving';

  async function save(values: ParsedValue[], summary: ParseSummary) {
    if (!values.length) return setPhase({ kind: 'error', message: 'No sleep, steps, weight, HRV or nutrition data found in this export.' });
    setPhase({ kind: 'saving', done: 0, total: values.length });
    for (let i = 0; i < values.length; i += CHUNK) {
      const last = i + CHUNK >= values.length;
      const res = await importAppleHealthExport(values.slice(i, i + CHUNK), last ? summary : null);
      if (!res.ok) return setPhase({ kind: 'error', message: res.error });
      setPhase({ kind: 'saving', done: Math.min(values.length, i + CHUNK), total: values.length });
    }
    setPhase({ kind: 'done', summary });
    router.refresh();
  }

  function read(file: File) {
    if (busy) return;
    if (!/\.(zip|xml)$/i.test(file.name)) return setPhase({ kind: 'error', message: 'Choose the export.zip (or export.xml) from the Health app.' });
    setPhase({ kind: 'reading', pct: 0 });
    const worker = new Worker(new URL('./health-export.worker.ts', import.meta.url));
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const m = e.data;
      if (m.type === 'progress') setPhase({ kind: 'reading', pct: Math.round((m.read / m.total) * 100) });
      else {
        worker.terminate();
        if (m.type === 'error') setPhase({ kind: 'error', message: m.message });
        else void save(m.result.values, m.result.summary);
      }
    };
    worker.onerror = () => {
      worker.terminate();
      setPhase({ kind: 'error', message: 'Couldn’t read this file in the browser. Try exporting again.' });
    };
    worker.postMessage(file);
  }

  return (
    <div className="mt-1 flex flex-col gap-4">
      {phase.kind !== 'done' && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Choose your Apple Health export file"
          onClick={() => !busy && input.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !busy && input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) read(f);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-3 rounded-[14px] border-2 border-dashed px-5 py-9 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60',
            over ? 'border-primary bg-primary/10' : 'border-white/15 hover:border-white/30',
            busy && 'cursor-default',
          )}
        >
          {busy ? <Loader2Icon className="size-8 animate-spin text-primary" aria-hidden /> : <FileArchiveIcon className="size-8 text-primary" aria-hidden />}
          {phase.kind === 'reading' ? (
            <div className="flex w-full max-w-xs flex-col gap-2">
              <b className="text-sm">Reading your export… {phase.pct}%</b>
              <div className="h-1.5 overflow-hidden rounded bg-track">
                <div className="h-full rounded bg-primary transition-all" style={{ width: `${phase.pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">Large exports take a minute. This happens in your browser.</span>
            </div>
          ) : phase.kind === 'saving' ? (
            <b className="text-sm">
              Saving daily totals… {phase.done.toLocaleString()} of {phase.total.toLocaleString()}
            </b>
          ) : (
            <>
              <b className="text-sm">Drop export.zip here, or click to choose it</b>
              <span className="text-xs text-muted-foreground">Read in your browser; only daily totals are sent to the dashboard.</span>
              <Button type="button" variant="outline" size="sm" className="rounded-[10px]" tabIndex={-1}>
                <UploadIcon aria-hidden />
                Choose file
              </Button>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept=".zip,.xml,application/zip,text/xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) read(f);
            }}
          />
        </div>
      )}

      {phase.kind === 'error' && (
        <p role="alert" className="rounded-[10px] border border-bad/40 bg-bad/10 px-3.5 py-2.5 text-[13px]">
          {phase.message}
        </p>
      )}

      {phase.kind === 'done' && (
        <div role="status" className="flex flex-col gap-3 rounded-[14px] border border-good/40 bg-good/[0.08] p-4">
          <div className="flex items-center gap-2.5">
            <PartyPopperIcon className="size-5 text-good" aria-hidden />
            <b>Imported {phase.summary.days.toLocaleString()} days of history</b>
          </div>
          <p className="text-[13px] text-subtle">
            {phase.summary.from} to {phase.summary.to}, from {phase.summary.points.toLocaleString()} Health records. The dashboard now shows it instead of sample data.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {METRIC_GUIDE.map((m) => {
              const n = phase.summary.metrics[m.metric] ?? 0;
              return (
                <li key={m.metric} className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]', n ? 'border-good/30 text-good' : 'border-white/10 text-muted-foreground')}>
                  {n > 0 && <CheckIcon className="size-3" aria-hidden />}
                  {m.label}
                  {n > 0 && <span className="text-good/70">· {n.toLocaleString()}d</span>}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-2 border-t border-good/20 pt-3">
            <span className="text-[13px] text-subtle">This is a snapshot. To keep it up to date automatically:</span>
            <Button size="sm" onClick={onShortcuts} className="rounded-[10px]">
              Set up daily updates with Shortcuts
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
