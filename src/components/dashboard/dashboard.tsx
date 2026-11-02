'use client';

import { useMemo, useState } from 'react';
import { feed, kpis, weekBlocks, weekSummary, weightAvg } from '@/lib/dashboard/compute';
import type { DashboardPayload } from '@/lib/dashboard/types';
import { AvatarCard } from './avatar';
import { ActivityCard, ConsistencyCard, KpiGrid, NutritionCard, PrCard, SourcesRow, WeekCard } from './cards';
import { BodyWeightCard, RecoveryCard, StrengthCard, WeeklyTimeCard } from './charts';
import { SyncButton } from './sync-button';
import { Segmented } from './ui-bits';

type Range = '7' | '30' | '90';

export function Dashboard({ data }: { data: DashboardPayload }) {
  const [rangeKey, setRangeKey] = useState<Range>('30');
  const range = Number(rangeKey);
  const { days } = data;

  const tiles = useMemo(() => kpis(days, range), [days, range]);
  const weeks = useMemo(() => weekBlocks(days), [days]);
  const week = useMemo(() => weekSummary(days, data.prs), [days, data.prs]);
  const items = useMemo(() => feed(days), [days]);

  const latestWeight = weightAvg(days, days.length - 1);
  const today = new Date(`${data.today}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pt-7 pb-14 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-bold">
            Master Dashboard
            {data.hevyMock && (
              <span className="ml-2 rounded-full border border-white/20 px-2.5 py-0.5 align-middle font-sans text-[11px] font-semibold tracking-wider text-subtle uppercase">Sample Hevy data</span>
            )}
          </h1>
          <p className="text-subtle">{today} · Training, recovery and nutrition in one place</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Segmented
            label="Time range"
            value={rangeKey}
            onChange={setRangeKey}
            options={[
              { value: '7', label: '7D' },
              { value: '30', label: '30D' },
              { value: '90', label: '90D' },
            ]}
          />
          <SyncButton />
        </div>
      </header>

      <SourcesRow sources={data.sources} />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_720px] flex-col gap-4">
          <KpiGrid items={tiles} />
          <div className="grid grid-cols-12 gap-4">
            <StrengthCard lifts={data.lifts} today={data.today} />
            <PrCard prs={data.prs} today={data.today} />
            <WeeklyTimeCard weeks={weeks} />
            <ConsistencyCard weeks={weeks} />
            <RecoveryCard days={days} range={range} />
            <NutritionCard days={days} range={range} />
            <BodyWeightCard days={days} range={range} />
            <ActivityCard items={items} />
          </div>
        </div>
        <aside aria-label="Avatar and weekly summary" className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <AvatarCard
            mode={data.avatar.mode}
            bodyFat={data.avatar.bodyFatPercent}
            week={week}
            stats={[
              { label: 'Weight', value: latestWeight != null ? `${latestWeight.toFixed(1)} kg` : '–' },
              { label: 'Body fat', value: data.avatar.bodyFatPercent != null ? `${data.avatar.bodyFatPercent.toFixed(1)}%` : '–' },
              { label: 'Bench / BW', value: data.avatar.benchToBodyweight != null ? `${data.avatar.benchToBodyweight.toFixed(2)}×` : '–' },
            ]}
          />
          <WeekCard week={week} />
        </aside>
      </div>
    </main>
  );
}
