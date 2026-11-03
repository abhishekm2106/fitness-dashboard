'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { saveDisplay } from '@/app/settings/actions';
import { Segmented } from '@/components/dashboard/ui-bits';
import { makeFmt, type Settings } from '@/lib/settings';

type Value = Pick<Settings, 'units' | 'display'>;

// Each choice saves as soon as it's picked; the preview shows what the dashboard will look like
export function DisplayForm({ initial }: { initial: Value }) {
  const [value, setValue] = useState(initial);
  const [, start] = useTransition();
  const fmt = makeFmt(value.units);

  function change(next: Value, patch: Parameters<typeof saveDisplay>[0]) {
    const prev = value;
    setValue(next);
    start(async () => {
      const res = await saveDisplay(patch);
      if (!res.ok) {
        setValue(prev);
        toast.error(res.error);
      } else toast.success('Saved');
    });
  }

  const rows: { label: string; hint: string; control: React.ReactNode }[] = [
    {
      label: 'Weight',
      hint: 'Lifts, volume, PRs and body weight',
      control: (
        <Segmented
          label="Weight unit"
          tone="teal"
          value={value.units.weight}
          onChange={(weight) => change({ ...value, units: { ...value.units, weight } }, { units: { weight } })}
          options={[
            { value: 'kg', label: 'Kilograms' },
            { value: 'lb', label: 'Pounds' },
          ]}
        />
      ),
    },
    {
      label: 'Distance',
      hint: 'Running distance and pace',
      control: (
        <Segmented
          label="Distance unit"
          tone="teal"
          value={value.units.distance}
          onChange={(distance) => change({ ...value, units: { ...value.units, distance } }, { units: { distance } })}
          options={[
            { value: 'km', label: 'Kilometres' },
            { value: 'mi', label: 'Miles' },
          ]}
        />
      ),
    },
    {
      label: 'Default time range',
      hint: 'What the dashboard opens with',
      control: (
        <Segmented
          label="Default time range"
          tone="teal"
          value={String(value.display.defaultRange) as '7' | '30' | '90'}
          onChange={(r) => {
            const defaultRange = Number(r) as Settings['display']['defaultRange'];
            change({ ...value, display: { ...value.display, defaultRange } }, { display: { defaultRange } });
          }}
          options={[
            { value: '7', label: '7 days' },
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
          ]}
        />
      ),
    },
    {
      label: 'Week starts on',
      hint: 'Weekly totals and the consistency heatmap',
      control: (
        <Segmented
          label="First day of the week"
          tone="teal"
          value={value.display.weekStart}
          onChange={(weekStart) => change({ ...value, display: { ...value.display, weekStart } }, { display: { weekStart } })}
          options={[
            { value: 'mon', label: 'Monday' },
            { value: 'sun', label: 'Sunday' },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      <ul className="divide-y divide-grid">
        {rows.map((r) => (
          <li key={r.label} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 py-4 first:pt-0">
            <div>
              <div className="text-sm font-medium">{r.label}</div>
              <div className="text-xs text-muted-foreground">{r.hint}</div>
            </div>
            {r.control}
          </li>
        ))}
      </ul>
      <div className="mt-2 rounded-[10px] bg-[#141413] px-4 py-3 text-sm">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Preview</span>
        <p className="mt-1 text-subtle">
          Bench e1RM <b className="text-foreground">{fmt.lift(102.5)}</b> · body weight <b className="text-foreground">{fmt.body(77.3)}</b> · weekly volume{' '}
          <b className="text-foreground">{fmt.volume(20800)}</b> · run <b className="text-foreground">{fmt.dist(10)}</b> at <b className="text-foreground">{fmt.pace(5.25)}</b>
        </p>
      </div>
    </div>
  );
}
