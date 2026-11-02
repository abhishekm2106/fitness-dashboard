import type { Fmt, Goals, WeekStart } from '@/lib/settings';
import type { DayRow, Lift, LiftPoint, PrEvent } from './types';

export const DAY = 86_400_000;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const LIFT_NAMES: Record<Lift, { name: string; short: string }> = {
  bench: { name: 'Bench press', short: 'Bench' },
  squat: { name: 'Back squat', short: 'Squat' },
  deadlift: { name: 'Deadlift', short: 'Deadlift' },
  ohp: { name: 'Overhead press', short: 'OHP' },
};

const toDate = (date: string) => new Date(`${date}T00:00:00Z`);
export const fd = (date: string) => `${MON[toDate(date).getUTCMonth()]} ${toDate(date).getUTCDate()}`;
export const fdw = (date: string) => `${WD[toDate(date).getUTCDay()]} ${fd(date)}`;
export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
export const hm = (h: number) => {
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};
export const hmMin = (m: number) => hm(m / 60);
export const pace = (p: number) => {
  const s = Math.round(p * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + (f(x) || 0), 0);
const avg = <T,>(a: T[], f: (x: T) => number) => (a.length ? sum(a, f) / a.length : 0);
const pct = (c: number, p: number) => (p ? ((c - p) / p) * 100 : 0);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export const sessions = (a: DayRow[]) => a.filter((d) => d.strength).length + a.filter((d) => d.cardio).length;
const vol = (d: DayRow) => d.strength?.volumeKg ?? 0;
const km = (d: DayRow) => d.cardio?.km ?? 0;

/** 7-day average weight ending on each day, ignoring days before the first weigh-in. */
export function weightAvg(days: DayRow[], i: number): number | null {
  const w = days.slice(Math.max(0, i - 6), i + 1).map((d) => d.weightKg).filter((x): x is number => x != null);
  return w.length ? Math.round((w.reduce((s, x) => s + x, 0) / w.length) * 10) / 10 : null;
}

export type Tone = 'good' | 'bad' | 'flat';
export interface Delta {
  text: string;
  tone: Tone;
}
function delta(c: number, p: number, goodUp: boolean, fmt: (v: number) => string): Delta {
  const d = c - p;
  if (Math.abs(d) < 1e-9) return { text: 'No change', tone: 'flat' };
  return { text: `${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}`, tone: d > 0 === goodUp ? 'good' : 'bad' };
}
const cum = (a: DayRow[], f: (d: DayRow) => number) => {
  let s = 0;
  return a.map((d) => (s += f(d) || 0));
};

export interface Kpi {
  label: string;
  color: string;
  value: string;
  delta: Delta;
  vs: string;
  sub: string;
  spark: number[];
  sample: boolean;
}

export function kpis(days: DayRow[], range: number, fmt: Fmt, goals: Goals): Kpi[] {
  const n = days.length;
  const cur = days.slice(n - range);
  const prev = days.slice(n - 2 * range, n - range);
  const vs = `vs previous ${range} days`;
  const kmCur = sum(cur, km);
  const minCur = sum(cur, (d) => d.cardio?.minutes ?? 0);
  const wNow = weightAvg(days, n - 1);
  const wThen = weightAvg(days, n - range - 1);
  const weights = cur.map((_, i) => weightAvg(days, n - range + i) ?? 0);
  return [
    {
      label: 'Workouts',
      color: 'var(--subtle)',
      value: String(sessions(cur)),
      delta: delta(sessions(cur), sessions(prev), true, (v) => String(v)),
      vs,
      sub: `${cur.filter((d) => d.strength).length} lifting · ${cur.filter((d) => d.cardio).length} cardio`,
      spark: cum(cur, (d) => (d.strength ? 1 : 0) + (d.cardio ? 1 : 0)),
      sample: false,
    },
    {
      label: 'Lifting volume',
      color: 'var(--chart-1)',
      value: fmt.volume(sum(cur, vol)),
      delta: delta(pct(sum(cur, vol), sum(prev, vol)), 0, true, (v) => `${v.toFixed(0)}%`),
      vs,
      sub: `Total ${fmt.weightUnit} lifted across working sets`,
      spark: cum(cur, vol),
      sample: false,
    },
    {
      label: 'Running distance',
      color: 'var(--chart-2)',
      value: fmt.dist(kmCur),
      delta: delta(pct(kmCur, sum(prev, km)), 0, true, (v) => `${v.toFixed(0)}%`),
      vs,
      sub: `Avg pace ${kmCur ? fmt.pace(minCur / kmCur) : `– /${fmt.distanceUnit}`}`,
      spark: cum(cur, km),
      sample: true,
    },
    {
      label: 'Avg sleep',
      color: 'var(--chart-3)',
      value: hm(avg(cur, (d) => d.sleepH)),
      delta: delta(avg(cur, (d) => d.sleepH) * 60, avg(prev, (d) => d.sleepH) * 60, true, (v) => `${Math.round(v)} min`),
      vs,
      sub: `${cur.filter((d) => d.sleepH >= goals.sleepHours).length} of ${range} nights at your ${goals.sleepHours}h goal`,
      spark: cur.map((d) => d.sleepH),
      sample: true,
    },
    {
      label: 'Avg HRV',
      color: 'var(--chart-3)',
      value: `${Math.round(avg(cur, (d) => d.hrv))} ms`,
      delta: delta(Math.round(avg(cur, (d) => d.hrv)), Math.round(avg(prev, (d) => d.hrv)), true, (v) => `${v} ms`),
      vs,
      sub: 'Overnight average',
      spark: cur.map((d) => d.hrv),
      sample: true,
    },
    {
      label: 'Body weight',
      color: 'var(--chart-4)',
      value: wNow != null ? fmt.body(wNow) : '–',
      delta: wNow != null && wThen != null ? delta(fmt.bodyNum(wNow), fmt.bodyNum(wThen), false, (v) => `${v.toFixed(1)} ${fmt.weightUnit}`) : { text: 'No weigh-ins', tone: 'flat' },
      vs: `over ${range} days`,
      sub: '7-day average · from Hevy',
      spark: weights.some((w) => w) ? weights.map((w) => w || weights.find(Boolean) || 0) : [0, 0],
      sample: false,
    },
  ];
}

export interface StrengthView {
  points: (LiftPoint & { label: string })[];
  current: number | null;
  change: number | null;
  best: LiftPoint | null;
}
export function strengthView(points: LiftPoint[], today: string): StrengthView {
  const from = toDate(today).getTime() - 90 * DAY;
  const pts = points.filter((p) => toDate(p.date).getTime() >= from).map((p) => ({ ...p, label: fd(p.date) }));
  if (!pts.length) return { points: [], current: null, change: null, best: null };
  const best = pts.reduce((b, p) => (p.e1rmKg > b.e1rmKg ? p : b));
  return { points: pts, current: pts[pts.length - 1].e1rmKg, change: Math.round((pts[pts.length - 1].e1rmKg - pts[0].e1rmKg) * 10) / 10, best };
}

export interface WeekBlock {
  weekStart: string;
  label: string;
  strengthMin: number;
  cardioMin: number;
  sessions: number;
  cells: { date: string; minutes: number; tip: string; future: boolean }[];
}
/** The last 12 weeks, starting on Monday or Sunday. */
export function weekBlocks(days: DayRow[], weekStart: WeekStart, fmt: Fmt): WeekBlock[] {
  const n = days.length;
  const last = toDate(days[n - 1].date).getUTCDay();
  const first = n - 1 - (weekStart === 'mon' ? (last + 6) % 7 : last);
  const out: WeekBlock[] = [];
  for (let k = 11; k >= 0; k--) {
    const ws = first - 7 * k;
    const block: WeekBlock = { weekStart: days[Math.max(0, ws)].date, label: fd(days[Math.max(0, ws)].date), strengthMin: 0, cardioMin: 0, sessions: 0, cells: [] };
    for (let j = 0; j < 7; j++) {
      const d = days[ws + j];
      if (!d) {
        block.cells.push({ date: '', minutes: 0, tip: 'Upcoming', future: true });
        continue;
      }
      const s = d.strength?.minutes ?? 0;
      const c = d.cardio?.minutes ?? 0;
      block.strengthMin += s;
      block.cardioMin += c;
      block.sessions += (d.strength ? 1 : 0) + (d.cardio ? 1 : 0);
      const parts = [d.strength && `${d.strength.title} · ${s} min`, d.cardio && `${d.cardio.long ? 'Long run' : 'Run'} ${fmt.dist(d.cardio.km)} · ${c} min (sample)`].filter(Boolean);
      block.cells.push({ date: d.date, minutes: s + c, tip: `${fdw(d.date)}\n${parts.length ? parts.join('\n') : 'Rest day'}`, future: false });
    }
    out.push(block);
  }
  return out;
}

export interface WeekSummary {
  dates: string;
  score: number;
  headline: string;
  intro: string;
  wins: string[];
  focus: string;
  closing: string;
  why: Record<'idle' | 'run' | 'curl' | 'flex' | 'thumbs' | 'rest', string>;
}
export function weekSummary(days: DayRow[], prs: PrEvent[], fmt: Fmt, goals: Goals): WeekSummary {
  const n = days.length;
  const w7 = days.slice(n - 7);
  const p7 = days.slice(n - 14, n - 7);
  const ses = sessions(w7);
  const lifts = w7.filter((d) => d.strength).length;
  const runs = w7.filter((d) => d.cardio).length;
  const kms = sum(w7, km);
  const volume = sum(w7, vol);
  const volPrev = sum(p7, vol);
  const sleep = avg(w7, (d) => d.sleepH);
  const proteinDays = w7.filter((d) => d.protein >= goals.protein).length;
  const pr7 = prs.filter((p) => p.date >= w7[0].date);
  const wNow = weightAvg(days, n - 1);
  const wPrev = weightAvg(days, n - 8);
  // sessions and sleep score full marks at your goals
  const score = Math.round(Math.min(40, (ses / goals.weeklySessions) * 40) + Math.min(25, (sleep / goals.sleepHours) * 25) + (proteinDays / 7) * 20 + (pr7.length ? 15 : volume >= volPrev ? 10 : 5));

  const wins: string[] = [];
  if (pr7.length) {
    const p = pr7[0];
    wins.push(`New ${LIFT_NAMES[p.lift].name.toLowerCase()} PR: ${fmt.lift(p.e1rmKg)} estimated 1RM (+${fmt.lift(p.gainKg)}). Real strength, earned.`);
  }
  if (volume > 0) {
    const vp = Math.round(Math.abs(pct(volume, volPrev)));
    wins.push(`Moved ${fmt.volume(volume)} of total volume${!volPrev ? '.' : volume >= volPrev ? `, up ${vp}% on last week.` : `, ${vp}% under last week. Fine if it was a deload.`}`);
  }
  if (kms > 0) wins.push(`Ran ${fmt.dist(kms)} across ${runs} ${runs === 1 ? 'run' : 'runs'}. Your engine is getting stronger.`);
  if (wNow != null && wPrev != null && wNow < wPrev) wins.push(`Down ${fmt.body(wPrev - wNow)} on your 7-day average, and your lifts are still climbing.`);

  const focus =
    sleep < goals.sleepHours - 0.5
      ? `Sleep averaged ${hm(sleep)}. Get closer to your ${goals.sleepHours}h goal and your next heavy session will feel lighter.`
      : proteinDays < 5
        ? `You hit your protein goal on ${proteinDays} of 7 days. Aim for ${goals.protein} g every day so the cut takes fat, not muscle.`
        : ses < goals.weeklySessions
          ? `Put ${goals.weeklySessions} sessions in your calendar for next week and treat them like meetings.`
          : `Keep the rhythm. Add one rep or ${fmt.plate} to your top set on each main lift.`;

  const bfNow = days[n - 1].bodyFat;
  const bfThen = days[n - 29]?.bodyFat ?? null;
  const rate = bfNow != null && bfThen != null ? (bfThen - bfNow) / 4 : 0;
  const closing =
    bfNow == null
      ? 'Log your body fat in Hevy (Profile → Measures) and this summary will track your progress toward a six-pack.'
      : bfNow <= 12
        ? 'Your abs are showing. Now the job is keeping them.'
        : rate > 0.03
          ? `At this pace your body fat goes from ${bfNow}% to 12%, where a six-pack shows, in about ${Math.ceil((bfNow - 12) / rate)} weeks. Stay the course.`
          : 'Body fat is holding steady. Tighten nutrition a little to get the trend moving again.';

  return {
    dates: `${fd(w7[0].date)} – ${fd(w7[6].date)}`,
    score,
    headline: score >= 85 ? 'Elite week. You are on fire.' : score >= 70 ? 'Strong week. Momentum is building.' : score >= 50 ? 'Solid week. There is more in the tank.' : 'Quiet week. Time to wake the engine up.',
    intro: `${ses} sessions in 7 days: ${lifts} lifting, ${runs} cardio. ${score >= 70 ? 'This is the kind of consistency that changes a physique.' : score >= 50 ? 'The habit is there. Now add intensity.' : 'Every streak starts with one session. Make tomorrow day one.'}`,
    wins: wins.slice(0, 3),
    focus,
    closing,
    why: {
      idle: `Effort score ${score}`,
      run: `${runs} ${runs === 1 ? 'run' : 'runs'} · ${fmt.dist(kms)} this week`,
      curl: `${lifts} lifting sessions · ${fmt.volume(volume)} this week`,
      flex: pr7.length ? `${pr7.length} new PR${pr7.length > 1 ? 's' : ''} this week` : `Effort score ${score}`,
      thumbs: `Effort score ${score} this week`,
      rest: `Only ${ses} sessions this week`,
    },
  };
}

export interface FeedItem {
  key: string;
  color: string;
  source: string;
  sample: boolean;
  title: string;
  detail: string;
  when: string;
}
export function feed(days: DayRow[], fmt: Fmt): FeedItem[] {
  const n = days.length;
  const items: FeedItem[] = [];
  const when = (i: number) => (i === n - 1 ? 'Today' : i === n - 2 ? 'Yesterday' : fdw(days[i].date));
  for (let i = n - 1; i >= n - 4 && i >= 0; i--) {
    const d = days[i];
    if (d.strength) {
      const s = d.strength;
      const top = s.topSet ? ` · ${LIFT_NAMES[s.topSet.lift].short} ${fmt.lift(s.topSet.weightKg)} × ${s.topSet.reps}` : '';
      items.push({ key: `w-${d.date}`, color: 'var(--chart-1)', source: 'Hevy', sample: false, title: `${s.title} · ${s.exercises} exercises`, detail: `${fmt.volume(s.volumeKg)} volume · ${s.minutes} min${top}`, when: when(i) });
    }
    if (d.cardio) {
      items.push({ key: `r-${d.date}`, color: 'var(--chart-2)', source: 'Strava', sample: true, title: `${d.cardio.long ? 'Long run' : 'Run'} · ${fmt.dist(d.cardio.km)}`, detail: `${d.cardio.minutes} min · ${fmt.pace(d.cardio.paceMinPerKm)}`, when: when(i) });
    }
    items.push({ key: `s-${d.date}`, color: 'var(--chart-3)', source: 'Oura', sample: true, title: `Slept ${hm(d.sleepH)}`, detail: `Overnight HRV ${d.hrv} ms`, when: when(i) });
  }
  return items.slice(0, 8);
}

/** Which art set represents a body mode; in-between modes borrow the closest one. */
export function artFor(mode: string, bodyFat: number | null): 'skinny' | 'toned' | 'bodybuilder' | 'heavy' {
  if (mode === 'Skinny') return 'skinny';
  if (mode === 'Bodybuilder') return 'bodybuilder';
  if (mode === 'Heavy' || mode === 'Strongman') return 'heavy';
  if (mode === 'Average') return (bodyFat ?? 0) >= 24 ? 'heavy' : 'toned';
  return 'toned';
}

export { clamp };
