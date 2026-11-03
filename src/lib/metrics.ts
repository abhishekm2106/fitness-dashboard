import { and, asc, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm';
import type { DB } from '@/db';
import { bodyMeasurements, workoutExercises, workouts, workoutSets } from '@/db/schema';
import { lastSync } from '@/lib/sync/hevy';

const DAY = 86_400_000;

// Hevy's built-in template titles for the four main lifts
export const MAIN_LIFTS = {
  bench: 'Bench Press (Barbell)',
  squat: 'Squat (Barbell)',
  deadlift: 'Deadlift (Barbell)',
  ohp: 'Overhead Press (Barbell)',
} as const;
type Lift = keyof typeof MAIN_LIFTS;

export interface LiftPoint {
  date: string;
  workoutId: string;
  e1rmKg: number;
  weightKg: number;
  reps: number;
}

export interface DashboardData {
  generatedAt: string;
  sync: { at: string; mock: boolean } | null;
  week: { sessions: number; prevSessions: number; volumeKg: number; prevVolumeKg: number; minutes: number; prs: PrEvent[] };
  lifts: Record<Lift, LiftPoint[]>;
  prs: PrEvent[];
  weeklyMinutes: { weekStart: string; minutes: number; sessions: number }[];
  workouts: { id: string; title: string; start: string; durationMin: number; volumeKg: number }[];
  body: { date: string; weightKg: number | null; fatPercent: number | null }[];
  avatar: { bodyFatPercent: number | null; weightKg: number | null; benchToBodyweight: number | null; muscle: number; mode: string };
}

export interface PrEvent {
  lift: Lift;
  date: string;
  e1rmKg: number;
  weightKg: number;
  reps: number;
  gainKg: number;
}

export function bodyMode(bf: number, muscle: number): string {
  if (bf >= 27) return muscle >= 70 ? 'Strongman' : 'Heavy';
  if (bf >= 21) return 'Average';
  if (muscle < 25) return 'Skinny';
  if (bf < 10 && muscle >= 85) return 'Bodybuilder';
  if (bf < 18 && muscle >= 45) return 'Toned';
  return 'Fit';
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const mondayOf = (t: number) => {
  const d = new Date(t);
  const back = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back);
};

export async function getDashboardData(db: DB, now = Date.now()): Promise<DashboardData> {
  const yearAgo = new Date(now - 365 * DAY);

  const recent = await db
    .select({ id: workouts.id, title: workouts.title, start: workouts.startTime, durationMin: workouts.durationMin, volumeKg: workouts.volumeKg })
    .from(workouts)
    .where(gte(workouts.startTime, yearAgo))
    .orderBy(desc(workouts.startTime));

  // best estimated 1RM per workout for each main lift
  const liftRows = await db
    .select({ workoutId: workouts.id, start: workouts.startTime, title: workoutExercises.title, e1rm: workoutSets.e1rmKg, weight: workoutSets.weightKg, reps: workoutSets.reps })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutSets.exerciseId, workoutExercises.id))
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .where(and(isNotNull(workoutSets.e1rmKg), inArray(workoutExercises.title, Object.values(MAIN_LIFTS)), gte(workouts.startTime, yearAgo)))
    .orderBy(asc(workouts.startTime));

  const lifts = { bench: [], squat: [], deadlift: [], ohp: [] } as Record<Lift, LiftPoint[]>;
  const byTitle = Object.fromEntries(Object.entries(MAIN_LIFTS).map(([k, v]) => [v, k as Lift]));
  for (const r of liftRows) {
    const lift = byTitle[r.title];
    if (!lift || r.e1rm == null) continue;
    const list = lifts[lift];
    const last = list[list.length - 1];
    const point = { date: iso(r.start), workoutId: r.workoutId, e1rmKg: r.e1rm, weightKg: r.weight ?? 0, reps: r.reps ?? 0 };
    if (last && last.workoutId === r.workoutId) {
      if (point.e1rmKg > last.e1rmKg) list[list.length - 1] = point;
    } else list.push(point);
  }

  const prs: PrEvent[] = [];
  for (const lift of Object.keys(lifts) as Lift[]) {
    let best = 0;
    for (const p of lifts[lift]) {
      if (best && p.e1rmKg > best) prs.push({ lift, date: p.date, e1rmKg: p.e1rmKg, weightKg: p.weightKg, reps: p.reps, gainKg: Math.round((p.e1rmKg - best) * 10) / 10 });
      best = Math.max(best, p.e1rmKg);
    }
  }
  prs.sort((a, b) => b.date.localeCompare(a.date));

  const inRange = (from: number, to: number) => recent.filter((w) => w.start.getTime() >= from && w.start.getTime() < to);
  const thisWeek = inRange(now - 7 * DAY, now + DAY);
  const lastWeek = inRange(now - 14 * DAY, now - 7 * DAY);
  const sum = (ws: typeof recent, f: (w: (typeof recent)[number]) => number) => ws.reduce((s, w) => s + f(w), 0);

  const weeklyMinutes = [];
  const thisMonday = mondayOf(now);
  for (let k = 11; k >= 0; k--) {
    const ws = inRange(thisMonday - k * 7 * DAY, thisMonday - (k - 1) * 7 * DAY);
    weeklyMinutes.push({ weekStart: iso(new Date(thisMonday - k * 7 * DAY)), minutes: sum(ws, (w) => w.durationMin), sessions: ws.length });
  }

  const body = (await db.select().from(bodyMeasurements).orderBy(asc(bodyMeasurements.date))).map((m) => ({ date: m.date, weightKg: m.weightKg, fatPercent: m.fatPercent }));
  const latestFat = [...body].reverse().find((m) => m.fatPercent != null)?.fatPercent ?? null;
  const latestWeight = [...body].reverse().find((m) => m.weightKg != null)?.weightKg ?? null;
  const bench = lifts.bench[lifts.bench.length - 1]?.e1rmKg ?? null;
  const ratio = bench && latestWeight ? Math.round((bench / latestWeight) * 100) / 100 : null;
  const muscle = ratio ? Math.round(Math.min(1, Math.max(0, (ratio - 0.7) / 0.9)) * 100) : 0;

  return {
    generatedAt: new Date(now).toISOString(),
    sync: await lastSync(db),
    week: {
      sessions: thisWeek.length,
      prevSessions: lastWeek.length,
      volumeKg: Math.round(sum(thisWeek, (w) => w.volumeKg)),
      prevVolumeKg: Math.round(sum(lastWeek, (w) => w.volumeKg)),
      minutes: sum(thisWeek, (w) => w.durationMin),
      prs: prs.filter((p) => Date.parse(p.date) >= now - 7 * DAY),
    },
    lifts,
    prs: prs.slice(0, 10),
    weeklyMinutes,
    workouts: recent.slice(0, 20).map((w) => ({ id: w.id, title: w.title, start: w.start.toISOString(), durationMin: w.durationMin, volumeKg: w.volumeKg })),
    body,
    avatar: {
      bodyFatPercent: latestFat,
      weightKg: latestWeight,
      benchToBodyweight: ratio,
      muscle,
      mode: latestFat != null ? bodyMode(latestFat, muscle) : 'Toned',
    },
  };
}
