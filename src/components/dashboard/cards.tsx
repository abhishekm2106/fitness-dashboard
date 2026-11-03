'use client';

import { CheckIcon, CircleDashedIcon } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { avgOf, fd, fmtInt, LIFT_NAMES, type FeedItem, type Kpi, type WeekBlock, type WeekSummary } from '@/lib/dashboard/compute';
import type { DayRow, Live, PrEvent, SourceStatus } from '@/lib/dashboard/types';
import { cn } from '@/lib/utils';
import { useSettings } from './settings-context';
import { Panel, SampleBadge, Sparkline, Swatch, toneClass } from './ui-bits';

const SOURCE_COLOR: Record<SourceStatus['id'], string> = {
  hevy: 'var(--chart-1)',
  lyfta: 'var(--chart-1)',
  strava: 'var(--chart-2)',
  oura: 'var(--chart-3)',
  'apple-health': 'var(--chart-4)',
  nutrition: 'var(--chart-4)',
};

export function SourcesRow({ sources }: { sources: SourceStatus[] }) {
  return (
    <section aria-label="Data sources" className="flex flex-wrap gap-2">
      {sources.map((s) => (
        <Link
          key={s.id}
          href={`/sources/${s.id}`}
          title={`See everything from ${s.name}`}
          className="flex items-center gap-2.5 rounded-[10px] border bg-card px-3 py-2 transition-colors outline-none hover:border-white/25 hover:bg-white/[0.03] focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Swatch color={SOURCE_COLOR[s.id]} />
          <div className="leading-tight">
            <b className="block text-[13px]">{s.name}</b>
            <small className="block text-[11px] text-muted-foreground">{s.via}</small>
          </div>
          <span className={cn('ml-1.5 inline-flex items-center gap-1 text-[11px] font-semibold', s.connected ? 'text-good' : 'text-muted-foreground')}>
            {s.connected ? <CheckIcon className="size-3" aria-hidden /> : <CircleDashedIcon className="size-3" aria-hidden />}
            {s.status}
          </span>
        </Link>
      ))}
    </section>
  );
}

const SAMPLE_SOURCE: Record<string, string> = { 'Running distance': 'Strava', 'Avg sleep': 'Apple Health', 'Avg HRV': 'Apple Health', 'Avg steps': 'Apple Health' };

export function KpiGrid({ items }: { items: Kpi[] }) {
  return (
    <section aria-label="Key numbers" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4 xl:grid-cols-4">
      {items.map((k) => (
        <Card key={k.label} className="min-w-0 gap-1.5 px-[18px] py-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-subtle">
            <Swatch color={k.color} />
            {k.label}
            {k.sample && <SampleBadge source={SAMPLE_SOURCE[k.label] ?? 'that app'} />}
          </div>
          <div className="font-display text-[30px] leading-tight font-bold">{k.value}</div>
          <div className="text-xs">
            <span className={cn('font-semibold', toneClass[k.delta.tone])}>{k.delta.text}</span> <span className="text-muted-foreground">{k.vs}</span>
          </div>
          <Sparkline values={k.spark} color={k.color} />
          <div className="text-[11px] text-muted-foreground">{k.sub}</div>
        </Card>
      ))}
    </section>
  );
}

export function PrCard({ prs, today }: { prs: PrEvent[]; today: string }) {
  const { fmt } = useSettings();
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - 90 * 86_400_000).toISOString().slice(0, 10);
  const recent = prs.filter((p) => p.date >= cutoff);
  return (
    <Panel title="Personal records" subtitle={`${recent.length} new e1RM records in the last 90 days`} className="col-span-12 xl:col-span-4">
      <ul className="divide-y divide-grid">
        {recent.slice(0, 5).map((p) => (
          <li key={`${p.lift}-${p.date}`} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <b className="block text-sm">{LIFT_NAMES[p.lift].name}</b>
              <span className="text-xs text-subtle">
                {fmt.lift(p.weightKg)} × {p.reps} · e1RM {fmt.lift(p.e1rmKg)}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-end text-[11px] text-muted-foreground">
              <b className="text-[13px] text-good">+{fmt.lift(p.gainKg)}</b>
              {fd(p.date)} · Hevy
            </div>
          </li>
        ))}
        {!recent.length && <li className="py-3 text-sm text-muted-foreground">No new records yet. Keep pushing.</li>}
      </ul>
    </Panel>
  );
}

const LEVELS = ['var(--track)', '#184f95', '#256abf', '#3987e5', '#6da7ec'];
const level = (m: number) => (m === 0 ? 0 : m < 40 ? 1 : m < 65 ? 2 : m < 90 ? 3 : 4);

const ROWS = { mon: ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'], sun: ['Sun', '', 'Tue', '', 'Thu', '', 'Sat'] };

export function ConsistencyCard({ weeks }: { weeks: WeekBlock[] }) {
  const { settings } = useSettings();
  const target = settings.goals.weeklySessions;
  const total = weeks.reduce((s, w) => s + w.sessions, 0);
  let streak = 0;
  for (let q = weeks.length - 2; q >= 0 && weeks[q].sessions >= target; q--) streak++;
  return (
    <Panel title="Consistency" subtitle={`${total} sessions in 12 weeks · ${streak}-week streak at ${target}+ sessions`} className="col-span-12 xl:col-span-5">
      <div className="flex gap-1">
        <div className="flex w-[30px] shrink-0 flex-col gap-1 text-[11px] leading-[22px] text-muted-foreground">
          {ROWS[settings.display.weekStart].map((d, i) => (
            <span key={i} className="h-[22px]">
              {d}
            </span>
          ))}
        </div>
        {weeks.map((w) => (
          <div key={w.weekStart} className="flex min-w-0 flex-1 flex-col gap-1">
            {w.cells.map((c, i) => (
              <div
                key={i}
                title={c.tip}
                className="h-[22px] rounded-[4px] hover:outline-2 hover:outline-offset-1 hover:outline-foreground"
                style={{ background: c.future ? '#141413' : LEVELS[level(c.minutes)] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1 pl-[34px] text-[11px] whitespace-nowrap text-muted-foreground">
        {weeks.map((w, j) => (
          <span key={w.weekStart} className="min-w-0 flex-1">
            {j % 4 === 0 ? w.label : ''}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <span>Rest</span>
        <i className="size-3.5 rounded-[3px]" style={{ background: LEVELS[0] }} />
        <span className="ml-2">Under 40 min</span>
        {LEVELS.slice(1).map((c) => (
          <i key={c} className="size-3.5 rounded-[3px]" style={{ background: c }} />
        ))}
        <span>90+ min</span>
      </div>
    </Panel>
  );
}

export function NutritionCard({ days, range, live }: { days: DayRow[]; range: number; live: Live }) {
  const { goals } = useSettings().settings;
  const y = days[days.length - 2];
  const past = days.slice(days.length - range);
  const logged = past.filter((d) => d.protein != null);
  const avgKcal = avgOf(past, (d) => d.kcal);
  const rows: [string, number | null, number, string][] = [
    ['Calories', y.kcal, goals.calories, ' kcal'],
    ['Protein', y.protein, goals.protein, ' g'],
    ['Carbs', y.carbs, goals.carbs, ' g'],
    ['Fat', y.fat, goals.fat, ' g'],
  ];
  return (
    <Panel
      title="Nutrition"
      subtitle={live.nutrition ? 'Yesterday · from Apple Health' : 'Yesterday'}
      sample={live.nutrition ? undefined : 'your nutrition app'}
      className="col-span-12 xl:col-span-4"
    >
      <div className="flex flex-col gap-4">
        {rows.map(([label, v, goal, unit]) => (
          <div key={label}>
            <div className="flex justify-between gap-2 text-[13px]">
              <b>{label}</b>
              <span className="text-subtle tabular-nums">
                {v != null ? fmtInt(v) : 'Not logged'} / {fmtInt(goal)}
                {unit}
              </span>
            </div>
            <div role="img" aria-label={v != null ? `${label} ${fmtInt(v)} of ${fmtInt(goal)}${unit}` : `${label} not logged`} className="mt-2 h-2 overflow-hidden rounded bg-track">
              <div className="h-full rounded bg-body" style={{ width: `${v == null ? 0 : goal ? Math.min(100, (v / goal) * 100) : 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-6 border-t border-grid pt-4">
        <div>
          <div className="text-xs text-muted-foreground">Avg calories · {range}D</div>
          <div className="font-display text-xl font-bold">{avgKcal != null ? `${fmtInt(avgKcal)} kcal` : '–'}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Protein goal hit</div>
          <div className="font-display text-xl font-bold">
            {logged.filter((d) => d.protein! >= goals.protein).length} of {logged.length} days
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function ActivityCard({ items }: { items: FeedItem[] }) {
  return (
    <Panel title="Activity" subtitle="Everything that synced in, newest first" className="col-span-12 xl:col-span-7">
      <ul className="divide-y divide-grid">
        {items.map((x) => (
          <li key={x.key} className="flex items-center gap-3.5 py-3">
            <Swatch color={x.color} className="size-2.5 rounded-[3px]" />
            <div className="min-w-0 flex-1">
              <b className="block text-sm">{x.title}</b>
              <span className="text-xs text-subtle">{x.detail}</span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-subtle">
                {x.source}
                {x.sample && <SampleBadge source={x.source} />}
              </span>
              {x.when}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function WeekCard({ week }: { week: WeekSummary }) {
  return (
    <Panel title="Your week" action={<span className="text-xs text-muted-foreground">{week.dates}</span>}>
      <div className="flex items-baseline gap-1.5">
        <b className="font-display text-[44px] leading-none font-extrabold">{week.score}</b>
        <span className="text-[13px] text-subtle">/ 100 effort score</span>
      </div>
      <div role="img" aria-label={`Effort score ${week.score} out of 100`} className="mt-2.5 h-2 overflow-hidden rounded bg-track">
        <div className="h-full rounded bg-teal" style={{ width: `${week.score}%` }} />
      </div>
      <p className="mt-[18px] text-lg leading-snug font-bold">{week.headline}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-subtle">{week.intro}</p>
      <ul className="mt-3.5 flex flex-col gap-2.5">
        {week.wins.map((w) => (
          <li key={w} className="flex gap-2.5 text-sm leading-relaxed">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
            <span>{w}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-[10px] bg-[#141413] px-3.5 py-3">
        <div className="text-[11px] font-semibold tracking-wider text-bad uppercase">Focus next week</div>
        <p className="mt-1 text-sm leading-relaxed">{week.focus}</p>
      </div>
      <p className="mt-3.5 text-[13px] leading-relaxed text-subtle">{week.closing}</p>
    </Panel>
  );
}
