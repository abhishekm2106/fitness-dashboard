'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { Metric } from '@/lib/apple-health/parse';
import { METRIC_GUIDE } from '@/lib/apple-health/status';
import { fd, fmtInt, hm } from '@/lib/dashboard/compute';
import { makeFmt, type Fmt, type Settings } from '@/lib/settings';
import type { AppleHealthData } from '@/lib/source-data';
import { cn } from '@/lib/utils';

const PAGE = 30;
const axis = { tickLine: false, axisLine: false, tick: { fill: 'var(--muted-foreground)', fontSize: 11 } } as const;

// How each metric is charted and written, in the viewer's units
function display(metric: Metric, fmt: Fmt): { chart: 'bar' | 'line'; num: (v: number) => number; text: (v: number) => string; axis: (v: number) => string } {
  switch (metric) {
    case 'sleep_h':
      return { chart: 'bar', num: (v) => v, text: hm, axis: (v) => `${v}h` };
    case 'weight_kg':
      return { chart: 'line', num: fmt.bodyNum, text: fmt.body, axis: (v) => v.toFixed(1) };
    case 'body_fat_pct':
      return { chart: 'line', num: (v) => v, text: (v) => `${v.toFixed(1)}%`, axis: (v) => `${v.toFixed(1)}%` };
    case 'hrv_ms':
      return { chart: 'line', num: (v) => v, text: (v) => `${Math.round(v)} ms`, axis: (v) => String(Math.round(v)) };
    case 'resting_hr':
      return { chart: 'line', num: (v) => v, text: (v) => `${Math.round(v)} bpm`, axis: (v) => String(Math.round(v)) };
    case 'steps':
      return { chart: 'bar', num: (v) => v, text: (v) => `${fmtInt(v)} steps`, axis: (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)) };
    case 'kcal':
    case 'active_kcal':
      return { chart: 'bar', num: (v) => v, text: (v) => `${fmtInt(v)} kcal`, axis: (v) => fmtInt(v) };
    default:
      return { chart: 'bar', num: (v) => v, text: (v) => `${fmtInt(v)} g`, axis: (v) => fmtInt(v) };
  }
}

const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function AppleHealthDataView({ data, units }: { data: AppleHealthData; units: Settings['units'] }) {
  const fmt = useMemo(() => makeFmt(units), [units]);
  const available = METRIC_GUIDE.filter((m) => data[m.metric]?.length);
  const [metric, setMetric] = useState<Metric>(available[0]?.metric ?? 'steps');
  const [page, setPage] = useState(0);
  const rows = useMemo(() => data[metric] ?? [], [data, metric]);
  const d = useMemo(() => display(metric, fmt), [metric, fmt]);
  const guide = METRIC_GUIDE.find((m) => m.metric === metric)!;

  const series = useMemo(() => [...rows].reverse().map((r) => ({ label: fd(r.date), value: Math.round(d.num(r.value) * 10) / 10 })), [rows, d]);
  const stats = useMemo(() => {
    if (!rows.length) return null;
    const vals = rows.map((r) => r.value);
    return { avg: vals.reduce((s, v) => s + v, 0) / vals.length, min: Math.min(...vals), max: Math.max(...vals), latest: rows[0] };
  }, [rows]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const total = available.reduce((n, m) => n + (data[m.metric]?.length ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-subtle">
        {fmtInt(total)} daily values across {available.length} metrics. Each value is one day&apos;s total or average; a newer delivery for the same day replaces it.
      </p>

      <div role="tablist" aria-label="Metrics" className="flex flex-wrap gap-1.5">
        {METRIC_GUIDE.map((m) => {
          const n = data[m.metric]?.length ?? 0;
          const on = m.metric === metric;
          return (
            <button
              key={m.metric}
              type="button"
              role="tab"
              aria-selected={on}
              disabled={!n}
              onClick={() => {
                setMetric(m.metric);
                setPage(0);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                on ? 'border-primary bg-primary text-primary-foreground' : 'border-white/10 text-subtle hover:border-white/25 hover:text-foreground',
              )}
            >
              {m.label}
              <span className={cn('text-[11px] tabular-nums', on ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{n}</span>
            </button>
          );
        })}
      </div>

      {stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ['Days', fmtInt(rows.length)],
              ['Average', d.text(stats.avg)],
              ['Lowest', d.text(stats.min)],
              ['Highest', d.text(stats.max)],
              ['Latest', d.text(stats.latest.value)],
            ].map(([k, v]) => (
              <Card key={k} className="gap-0.5 px-4 py-3">
                <span className="text-[11px] text-muted-foreground">{k}</span>
                <b className="truncate font-display text-lg">{v}</b>
              </Card>
            ))}
          </div>

          <Card className="gap-3 px-5 py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">{guide.app}</h3>
              <span className="text-xs text-muted-foreground">
                {day(rows.at(-1)!.date)} – {day(rows[0].date)} · Used for: {guide.powers}
              </span>
            </div>
            <ChartContainer config={{ value: { label: guide.label, color: 'var(--chart-3)' } }} className="aspect-auto h-[240px] w-full">
              {d.chart === 'bar' ? (
                <BarChart data={series} margin={{ left: 0, right: 0, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis dataKey="label" {...axis} minTickGap={28} />
                  <YAxis {...axis} width={44} tickFormatter={d.axis} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => d.text(Number(v))} />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={series.length > 60 ? 1 : 3} />
                </BarChart>
              ) : (
                <LineChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis dataKey="label" {...axis} minTickGap={28} />
                  <YAxis {...axis} width={44} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={d.axis} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => d.text(Number(v))} />} />
                  <Line dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={series.length < 40} />
                </LineChart>
              )}
            </ChartContainer>
          </Card>

          <Card className="gap-0 overflow-hidden p-0">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-white/[0.04] text-[11px] tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Date</th>
                  <th className="px-5 py-2.5 text-right font-semibold">{guide.label}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {shown.map((r) => (
                  <tr key={r.date}>
                    <td className="px-5 py-2">{day(r.date)}</td>
                    <td className="px-5 py-2 text-right font-medium tabular-nums">{d.text(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3 text-[13px]">
                <span className="text-muted-foreground">
                  {page * PAGE + 1}–{Math.min(rows.length, page * PAGE + PAGE)} of {rows.length} days
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    Newer
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                    Older
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No values for this metric yet.</p>
      )}
    </div>
  );
}
