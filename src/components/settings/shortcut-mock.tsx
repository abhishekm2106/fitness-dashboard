'use client';

import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  GlobeIcon,
  HeartIcon,
  ListIcon,
  PlusIcon,
  SigmaIcon,
  SearchIcon,
  VariableIcon,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// What the Shortcuts editor looks like after each recipe step. Steps with real iPhone screenshots
// (public/setup/shortcuts) show those; the rest are drawn in code in the style of iOS dark mode.

/** Real iPhone screenshots for a step, one at a time with previous/next when there are several */
export function Shots({ shots }: { shots: { src: string; caption: string }[] }) {
  const [i, setI] = useState(0);
  const shot = shots[i];
  return (
    <figure className="mx-auto flex w-full max-w-[250px] shrink-0 flex-col gap-1.5">
      <div className="overflow-hidden rounded-[28px] border border-white/15 bg-black shadow-[0_20px_50px_-25px_rgba(79,216,230,0.45)]">
        <Image src={shot.src} alt={shot.caption} width={560} height={1139} className="block h-auto w-full" />
      </div>
      <figcaption className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {shots.length > 1 && (
          <button
            type="button"
            onClick={() => setI((n) => n - 1)}
            disabled={i === 0}
            aria-label="Previous screenshot"
            className="grid size-7 shrink-0 place-items-center rounded-full text-foreground hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
        )}
        <span className="min-w-0 flex-1 text-center">
          {shot.caption}
          {shots.length > 1 && (
            <span className="block text-[10.5px] opacity-70">
              {i + 1} of {shots.length}
            </span>
          )}
        </span>
        {shots.length > 1 && (
          <button
            type="button"
            onClick={() => setI((n) => n + 1)}
            disabled={i === shots.length - 1}
            aria-label="Next screenshot"
            className="grid size-7 shrink-0 place-items-center rounded-full text-foreground hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronRightIcon className="size-4" />
          </button>
        )}
      </figcaption>
    </figure>
  );
}

/** A setting you tap to change: shown in blue in Shortcuts */
export const Tok = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-[#0a84ff]">{children}</span>;

/** A variable pill; named variables are what the recipe calls orange */
export const Pill = ({ children, magic }: { children: React.ReactNode; magic?: boolean }) => (
  <span
    className={cn(
      'mx-0.5 inline-flex translate-y-[-1px] items-center gap-1 rounded-[6px] px-1.5 py-px align-middle text-[10.5px] font-semibold',
      magic ? 'bg-[#0a84ff]/20 text-[#64b0ff]' : 'bg-[#c98500]/25 text-[#f0b445]',
    )}
  >
    {magic ? <SigmaIcon className="size-2.5" aria-hidden /> : <VariableIcon className="size-2.5" aria-hidden />}
    {children}
  </span>
);

const ICONS = {
  date: { icon: CalendarIcon, bg: 'bg-[#ff453a]' },
  health: { icon: HeartIcon, bg: 'bg-[#ff2d55]' },
  variable: { icon: VariableIcon, bg: 'bg-[#ff9f0a]' },
  math: { icon: SigmaIcon, bg: 'bg-[#8e8e93]' },
  web: { icon: GlobeIcon, bg: 'bg-[#0a84ff]' },
  list: { icon: ListIcon, bg: 'bg-[#30d158]' },
} satisfies Record<string, { icon: LucideIcon; bg: string }>;

/** One action card as it sits in the editor, optionally with filter or option rows underneath */
export function Act({ kind, children, rows }: { kind: keyof typeof ICONS; children: React.ReactNode; rows?: React.ReactNode[] }) {
  const { icon: Icon, bg } = ICONS[kind];
  return (
    <div className="overflow-hidden rounded-[12px] bg-[#2c2c2e]">
      <div className="flex items-start gap-2 px-2.5 py-2 text-[11.5px] leading-[1.55] text-white">
        <span className={cn('mt-px grid size-[18px] shrink-0 place-items-center rounded-[5px]', bg)}>
          <Icon className="size-3 text-white" aria-hidden />
        </span>
        <span className="min-w-0">{children}</span>
      </div>
      {rows && (
        <div className="divide-y divide-white/[0.07] border-t border-white/[0.07]">
          {rows.map((r, i) => (
            <div key={i} className="px-2.5 py-1.5 text-[11px] text-white/85">
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The phone frame with the editor's top bar, the actions, and the search field at the bottom */
export function Editor({ children, title = 'Send to Master Dashboard', note }: { children: React.ReactNode; title?: string; note?: string }) {
  return (
    <figure className="mx-auto flex w-full max-w-[250px] shrink-0 flex-col gap-1.5">
      <div aria-hidden className="rounded-[30px] border border-white/15 bg-[#0b0b0c] p-2 shadow-[0_20px_50px_-25px_rgba(79,216,230,0.45)]">
        <div className="mx-auto mb-1.5 h-3.5 w-16 rounded-full bg-black" />
        <div className="flex min-h-[200px] flex-col gap-1.5 rounded-[22px] bg-black px-2 pt-2 pb-2.5">
          <div className="flex items-center justify-between px-1 pb-1 text-[11px]">
            <ChevronLeftIcon className="size-4 text-[#0a84ff]" />
            <b className="truncate text-white">{title}</b>
            <span className="text-[#0a84ff]">Done</span>
          </div>
          {children}
          <div className="mt-auto flex items-center gap-1.5 rounded-[9px] bg-[#1c1c1e] px-2 py-1.5 text-[10.5px] text-white/40">
            <SearchIcon className="size-3" />
            Search for apps and actions
          </div>
        </div>
      </div>
      <figcaption className="text-center text-[11px] text-muted-foreground">{note ?? 'Illustration: your screen when this step is done'}</figcaption>
    </figure>
  );
}

/** A settings-style screen (for the new-shortcut and automation screens) */
export function SettingsScreen({
  title,
  rows,
  note,
  header,
}: {
  title: string;
  rows: {
    label: string;
    value?: string;
    on?: boolean;
    check?: boolean;
    toggle?: boolean;
  }[];
  note?: string;
  header?: React.ReactNode;
}) {
  return (
    <figure className="mx-auto flex w-full max-w-[250px] shrink-0 flex-col gap-1.5">
      <div aria-hidden className="rounded-[30px] border border-white/15 bg-[#0b0b0c] p-2 shadow-[0_20px_50px_-25px_rgba(79,216,230,0.45)]">
        <div className="mx-auto mb-1.5 h-3.5 w-16 rounded-full bg-black" />
        <div className="flex min-h-[200px] flex-col gap-2 rounded-[22px] bg-black px-2 pt-2 pb-3">
          <div className="flex items-center justify-between px-1 text-[11px]">
            <ChevronLeftIcon className="size-4 text-[#0a84ff]" />
            <b className="text-white">{title}</b>
            <span className="w-4" />
          </div>
          {header}
          <div className="divide-y divide-white/[0.07] overflow-hidden rounded-[12px] bg-[#1c1c1e]">
            {rows.map((r) => (
              <div key={r.label} className={cn('flex items-center justify-between gap-2 px-2.5 py-2 text-[11px]', r.on && 'bg-primary/15 ring-1 ring-primary/60 ring-inset')}>
                <span className="text-white/90">{r.label}</span>
                {r.toggle != null ? (
                  <span className={cn('relative h-[15px] w-[26px] rounded-full', r.toggle ? 'bg-[#30d158]' : 'bg-white/20')}>
                    <span className={cn('absolute top-[1.5px] size-3 rounded-full bg-white', r.toggle ? 'right-[1.5px]' : 'left-[1.5px]')} />
                  </span>
                ) : r.check ? (
                  <span className="text-[#0a84ff]">✓</span>
                ) : (
                  <span className={cn('truncate', r.on ? 'font-semibold text-primary' : 'text-white/45')}>{r.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="text-center text-[11px] text-muted-foreground">{note ?? 'Illustration'}</figcaption>
    </figure>
  );
}

/** The Shortcuts tab with the + button, for creating a new shortcut */
export function NewShortcutScreen() {
  return (
    <figure className="mx-auto flex w-full max-w-[250px] shrink-0 flex-col gap-1.5">
      <div aria-hidden className="rounded-[30px] border border-white/15 bg-[#0b0b0c] p-2 shadow-[0_20px_50px_-25px_rgba(79,216,230,0.45)]">
        <div className="mx-auto mb-1.5 h-3.5 w-16 rounded-full bg-black" />
        <div className="flex min-h-[200px] flex-col gap-2 rounded-[22px] bg-black px-2.5 pt-2 pb-2">
          <div className="flex items-center justify-end">
            <span className="grid size-6 place-items-center rounded-full bg-primary/20 ring-2 ring-primary">
              <PlusIcon className="size-4 text-[#0a84ff]" />
            </span>
          </div>
          <b className="text-[17px] text-white">All Shortcuts</b>
          <div className="grid grid-cols-2 gap-1.5">
            {['#5e5ce6', '#ff9f0a', '#30d158', '#ff375f'].map((c) => (
              <div key={c} className="h-12 rounded-[10px] opacity-60" style={{ background: c }} />
            ))}
          </div>
          <div className="mt-auto flex justify-around border-t border-white/10 pt-1.5 text-[9px] text-white/50">
            <span className="flex flex-col items-center gap-0.5 text-[#0a84ff]">
              <ListIcon className="size-3.5" />
              Shortcuts
            </span>
            <span className="flex flex-col items-center gap-0.5">
              <ClockIcon className="size-3.5" />
              Automation
            </span>
            <span className="flex flex-col items-center gap-0.5">
              <CalendarIcon className="size-3.5" />
              Gallery
            </span>
          </div>
        </div>
      </div>
      <figcaption className="text-center text-[11px] text-muted-foreground">Illustration: tap + at the top of All Shortcuts</figcaption>
    </figure>
  );
}
