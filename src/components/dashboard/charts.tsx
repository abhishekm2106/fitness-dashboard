'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { fd, hm, LIFT_NAMES, strengthView, weightAvg, type WeekBlock } from '@/lib/dashboard/compute';
import type { DayRow, Lift, LiftPoint } from '@/lib/dashboard/types';
import { Panel, Segmented } from './ui-bits';

const axis = { tickLine: false, axisLine: false, tick: { fill: 'var(--muted-foreground)', fontSize: 11 } } as const;

export function StrengthCard({ lifts, today }: { lifts: Record<Lift, LiftPoint[]>; today: string }) {
  const [lift, setLift] = useState<Lift>('bench');
  const view = strengthView(lifts[lift], today);
  const config = { e1rmKg: { label: 'e1RM', color: 'var(--chart-1)' } } satisfies ChartConfig;
  const stats: [string, string, string?][] = [
    ['Current e1RM', view.current != null ? `${view.current} kg` : '–'],
    ['90-day change', view.change != null ? `${view.change >= 0 ? '+' : '−'}${Math.abs(view.change).toFixed(1)} kg` : '–', view.change != null && view.change >= 0 ? 'text-good' : undefined],
    ['Best set', view.best ? `${view.best.weightKg} × ${view.best.reps}` : '–'],
    ['Sessions', String(view.points.length)],
  ];
  return (
    <Panel
      title="Strength progress"
      subtitle="Estimated 1RM from each session's best set · last 90 days · from Hevy"
      className="col-span-12 xl:col-span-8"
      action={<Segmented label="Lift" value={lift} onChange={setLift} options={(Object.keys(LIFT_NAMES) as Lift[]).map((l) => ({ value: l, label: LIFT_NAMES[l].short }))} />}
    >
      <div className="flex flex-wrap gap-8">
        {stats.map(([k, v, cls]) => (
          <div key={k}>
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className={`font-display text-[26px] font-bold ${cls ?? ''}`}>{v}</div>
          </div>
        ))}
      </div>
      {view.points.length ? (
        <ChartContainer config={config} className="mt-4 aspect-auto h-[250px] w-full">
          <LineChart data={view.points} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="label" {...axis} minTickGap={28} />
            <YAxis {...axis} width={48} domain={['dataMin - 3', 'dataMax + 3']} tickFormatter={(v: number) => `${Math.round(v)} kg`} />
            <ChartTooltip content={<ChartTooltipContent formatter={(v, _n, item) => `${LIFT_NAMES[lift].name}: ${item.payload.weightKg} kg × ${item.payload.reps} → ${v} kg e1RM`} />} />
            <Line dataKey="e1rmKg" stroke="var(--color-e1rmKg)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
          </LineChart>
        </ChartContainer>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">No {LIFT_NAMES[lift].name.toLowerCase()} sessions in the last 90 days.</p>
      )}
    </Panel>
  );
}

export function WeeklyTimeCard({ weeks }: { weeks: WeekBlock[] }) {
  const data = weeks.map((w) => ({ label: w.label, strength: Math.round((w.strengthMin / 60) * 10) / 10, cardio: Math.round((w.cardioMin / 60) * 10) / 10 }));
  const full = weeks.slice(0, 11);
  const avgMin = full.reduce((s, w) => s + w.strengthMin + w.cardioMin, 0) / full.length;
  const config = {
    strength: { label: 'Strength · Hevy', color: 'var(--chart-1)' },
    cardio: { label: 'Cardio · Strava (sample)', color: 'var(--chart-2)' },
  } satisfies ChartConfig;
  return (
    <Panel title="Weekly training time" subtitle={`Last 12 weeks · avg ${hm(avgMin / 60)} per week`} className="col-span-12 xl:col-span-7">
      <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
        <BarChart data={data} margin={{ left: 0, right: 0, top: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="label" {...axis} interval={2} />
          <YAxis {...axis} width={36} tickFormatter={(v: number) => `${v}h`} />
          <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => `${config[name as keyof typeof config].label}: ${v} h`} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="strength" stackId="t" fill="var(--color-strength)" />
          <Bar dataKey="cardio" stackId="t" fill="var(--color-cardio)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </Panel>
  );
}

export function RecoveryCard({ days, range }: { days: DayRow[]; range: number }) {
  const cur = days.slice(days.length - range).map((d) => ({ label: fd(d.date), sleep: Math.round(d.sleepH * 10) / 10, hrv: d.hrv }));
  const goal = cur.filter((d) => d.sleep >= 8).length;
  const avgHrv = Math.round(cur.reduce((s, d) => s + d.hrv, 0) / cur.length);
  return (
    <Panel title="Recovery" subtitle={`From Oura · last ${range} days`} sample="Oura" className="col-span-12 xl:col-span-8">
      <div className="grid gap-7 md:grid-cols-2">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <h3 className="font-semibold text-subtle">Sleep per night</h3>
            <span className="text-xs text-muted-foreground">
              {goal} of {range} nights at 8h+
            </span>
          </div>
          <ChartContainer config={{ sleep: { label: 'Sleep', color: 'var(--chart-3)' } }} className="mt-3 aspect-auto h-[190px] w-full">
            <BarChart data={cur} margin={{ left: 0, right: 0, top: 12 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="label" {...axis} minTickGap={24} />
              <YAxis {...axis} width={30} domain={[0, 10]} ticks={[0, 5, 10]} tickFormatter={(v: number) => `${v}h`} />
              <ReferenceLine y={8} stroke="var(--subtle)" strokeDasharray="4 4" label={{ value: '8h goal', position: 'insideTopRight', fill: 'var(--subtle)', fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => `Slept ${hm(Number(v))}`} />} />
              <Bar dataKey="sleep" fill="var(--color-sleep)" radius={range > 40 ? 1 : 4} />
            </BarChart>
          </ChartContainer>
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <h3 className="font-semibold text-subtle">Overnight HRV</h3>
            <span className="text-xs text-muted-foreground">avg {avgHrv} ms</span>
          </div>
          <ChartContainer config={{ hrv: { label: 'HRV', color: 'var(--chart-3)' } }} className="mt-3 aspect-auto h-[190px] w-full">
            <LineChart data={cur} margin={{ left: 0, right: 8, top: 12 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="label" {...axis} minTickGap={24} />
              <YAxis {...axis} width={30} domain={['dataMin - 4', 'dataMax + 4']} tickFormatter={(v: number) => String(Math.round(v))} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => `HRV ${v} ms`} />} />
              <Line dataKey="hrv" stroke="var(--color-hrv)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </div>
      </div>
    </Panel>
  );
}

export function BodyWeightCard({ days, range }: { days: DayRow[]; range: number }) {
  const n = days.length;
  const data = days
    .slice(n - range)
    .map((d, i) => ({ label: fd(d.date), weight: weightAvg(days, n - range + i) }))
    .filter((d): d is { label: string; weight: number } => d.weight != null);
  const now = data.at(-1)?.weight ?? null;
  const then = data[0]?.weight ?? null;
  const diff = now != null && then != null ? now - then : null;
  return (
    <Panel
      title="Body weight"
      subtitle={`7-day average · from Hevy · last ${range} days`}
      className="col-span-12 xl:col-span-5"
      action={
        now != null && (
          <div className="text-right">
            <div className="font-display text-2xl font-bold">{now.toFixed(1)} kg</div>
            {diff != null && (
              <div className={`text-xs font-semibold ${diff <= 0 ? 'text-good' : 'text-bad'}`}>
                {diff <= 0 ? '▼' : '▲'} {Math.abs(diff).toFixed(1)} kg over {range} days
              </div>
            )}
          </div>
        )
      }
    >
      {data.length ? (
        <>
          <ChartContainer config={{ weight: { label: 'Weight', color: 'var(--chart-4)' } }} className="aspect-auto h-[210px] w-full">
            <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="label" {...axis} minTickGap={24} />
              <YAxis {...axis} width={40} domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(v: number) => v.toFixed(1)} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => `7-day avg ${Number(v).toFixed(1)} kg`} />} />
              <Line dataKey="weight" stroke="var(--color-weight)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
          {diff != null && <p className="mt-3 text-xs text-muted-foreground">Trend {diff <= 0 ? '−' : '+'}{Math.abs(diff / (range / 7)).toFixed(2)} kg per week. Daily weigh-ins are noisy, so the line shows the 7-day average.</p>}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No weigh-ins yet. Log your weight in Hevy (Profile → Measures) and it will appear here.</p>
      )}
    </Panel>
  );
}
