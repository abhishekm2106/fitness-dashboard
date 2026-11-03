'use client';

import { ChevronDownIcon, SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Segmented } from '@/components/dashboard/ui-bits';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fmtInt } from '@/lib/dashboard/compute';
import { makeFmt, type Settings } from '@/lib/settings';
import type { HevyData, HevySet } from '@/lib/source-data';
import { cn } from '@/lib/utils';

const PAGE = 20;

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const SET_TYPE: Record<string, string> = { warmup: 'Warm-up', normal: 'Working', failure: 'Failure', dropset: 'Drop set' };

function SetRow({ s, fmt }: { s: HevySet; fmt: ReturnType<typeof makeFmt> }) {
  const load =
    s.weightKg != null && s.reps != null
      ? `${fmt.lift(s.weightKg)} × ${s.reps}`
      : s.reps != null
        ? `${s.reps} reps`
        : s.distanceMeters != null
          ? fmt.dist(s.distanceMeters / 1000)
          : s.durationSeconds != null
            ? `${Math.floor(s.durationSeconds / 60)}:${String(s.durationSeconds % 60).padStart(2, '0')}`
            : '–';
  return (
    <tr className="text-[13px]">
      <td className="py-1.5 pr-3 text-muted-foreground tabular-nums">{s.index + 1}</td>
      <td className="py-1.5 pr-3">
        <span className={cn('rounded px-1.5 py-0.5 text-[11px]', s.type === 'normal' ? 'bg-white/[0.06] text-subtle' : s.type === 'warmup' ? 'bg-[#c98500]/15 text-[#f0b445]' : 'bg-bad/15 text-bad')}>
          {SET_TYPE[s.type] ?? s.type}
        </span>
      </td>
      <td className="py-1.5 pr-3 font-medium tabular-nums">{load}</td>
      <td className="py-1.5 pr-3 text-subtle tabular-nums">{s.rpe != null ? `RPE ${s.rpe}` : ''}</td>
      <td className="py-1.5 text-right text-subtle tabular-nums">{s.e1rmKg != null ? `e1RM ${fmt.lift(s.e1rmKg)}` : ''}</td>
    </tr>
  );
}

export function HevyDataView({ data, units, mock }: { data: HevyData; units: Settings['units']; mock: boolean }) {
  const fmt = useMemo(() => makeFmt(units), [units]);
  const [tab, setTab] = useState<'workouts' | 'body'>('workouts');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? data.workouts.filter((w) => w.title.toLowerCase().includes(q) || w.exercises.some((e) => e.title.toLowerCase().includes(q))) : data.workouts;
  }, [data.workouts, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const totalSets = data.workouts.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Workouts', fmtInt(data.workouts.length)],
          ['Sets', fmtInt(totalSets)],
          ['First workout', data.workouts.length ? day(data.workouts.at(-1)!.start.slice(0, 10)) : '–'],
          ['Body measurements', fmtInt(data.body.length)],
        ].map(([k, v]) => (
          <Card key={k} className="gap-0.5 px-4 py-3">
            <span className="text-[11px] text-muted-foreground">{k}</span>
            <b className="font-display text-xl">{v}</b>
          </Card>
        ))}
      </div>
      {mock && <p className="text-[13px] text-subtle">These are sample workouts. Add your Hevy API key and sync to see your real history here.</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Hevy data"
          value={tab}
          onChange={(t) => setTab(t)}
          options={[
            { value: 'workouts', label: `Workouts · ${data.workouts.length}` },
            { value: 'body', label: `Body measurements · ${data.body.length}` },
          ]}
        />
        {tab === 'workouts' && (
          <label className="relative w-full sm:w-64">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search workouts or exercises"
              aria-label="Search workouts or exercises"
              className="h-9 rounded-[10px] pl-9"
            />
          </label>
        )}
      </div>

      {tab === 'workouts' ? (
        <Card className="gap-0 overflow-hidden p-0">
          {shown.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted-foreground">No workouts match &ldquo;{query}&rdquo;.</p>}
          <ul className="divide-y divide-white/[0.06]">
            {shown.map((w) => {
              const isOpen = open.has(w.id);
              const sets = w.exercises.reduce((n, e) => n + e.sets.length, 0);
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => toggle(w.id)}
                    aria-expanded={isOpen}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3 text-left transition-colors hover:bg-white/[0.03] sm:grid-cols-[1fr_repeat(4,auto)_auto]"
                  >
                    <span className="min-w-0">
                      <b className="block truncate text-sm">{w.title}</b>
                      <span className="text-xs text-muted-foreground">{when(w.start)}</span>
                    </span>
                    <span className="hidden text-[13px] text-subtle tabular-nums sm:block">{w.minutes} min</span>
                    <span className="hidden text-[13px] text-subtle tabular-nums sm:block">{w.exercises.length} exercises</span>
                    <span className="hidden text-[13px] text-subtle tabular-nums sm:block">{sets} sets</span>
                    <span className="hidden text-[13px] font-medium tabular-nums sm:block">{fmt.volume(w.volumeKg)}</span>
                    <ChevronDownIcon className={cn('size-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} aria-hidden />
                    <span className="col-span-2 text-xs text-subtle sm:hidden">
                      {w.minutes} min · {w.exercises.length} exercises · {sets} sets · {fmt.volume(w.volumeKg)}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="flex flex-col gap-4 border-t border-white/[0.06] bg-[#141413] px-5 py-4">
                      {w.exercises.map((e, i) => (
                        <div key={`${e.title}-${i}`} className="min-w-0">
                          <div className="text-sm font-semibold">{e.title}</div>
                          {e.notes && <div className="text-xs text-muted-foreground italic">{e.notes}</div>}
                          <div className="mt-1 overflow-x-auto">
                            <table className="w-full min-w-[420px]">
                              <tbody>
                                {e.sets.map((s) => (
                                  <SetRow key={s.index} s={s} fmt={fmt} />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      {!w.exercises.length && <p className="text-[13px] text-muted-foreground">No exercises recorded.</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3 text-[13px]">
              <span className="text-muted-foreground">
                {page * PAGE + 1}–{Math.min(filtered.length, page * PAGE + PAGE)} of {filtered.length}
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
      ) : (
        <Card className="gap-0 overflow-x-auto p-0">
          {data.body.length ? (
            <table className="w-full min-w-[480px] text-left text-[13px]">
              <thead className="bg-white/[0.04] text-[11px] tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Date</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Weight</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Body fat</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Lean mass</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {data.body.map((b) => (
                  <tr key={b.date}>
                    <td className="px-5 py-2.5">{day(b.date)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{b.weightKg != null ? fmt.body(b.weightKg) : '–'}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{b.fatPercent != null ? `${b.fatPercent.toFixed(1)}%` : '–'}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{b.leanMassKg != null ? fmt.body(b.leanMassKg) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No body measurements yet. Log them in Hevy under Profile → Measures.</p>
          )}
        </Card>
      )}
    </div>
  );
}
