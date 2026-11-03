import { desc, eq, gte, sql } from 'drizzle-orm';
import type { DB } from '@/db';
import { workoutExercises, workouts } from '@/db/schema';
import { healthByDate, lastDelivery } from '@/lib/apple-health/store';
import { getDashboardData } from '@/lib/metrics';
import { sampleDay } from './sample';
import type { DashboardPayload, DayRow, Lift, Live, SourceStatus, StrengthDay } from './types';

const DAY = 86_400_000;
const WINDOW = 182; // enough for a 90-day view compared with the 90 days before it

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

function ago(at: string, now: number): string {
  const m = Math.round((now - Date.parse(at)) / 60_000);
  if (m < 1) return 'Synced just now';
  if (m < 60) return `Synced ${m} min ago`;
  if (m < 48 * 60) return `Synced ${Math.round(m / 60)} h ago`;
  return `Synced ${Math.round(m / 1440)} days ago`;
}

export async function getDashboardPayload(db: DB, now = Date.now()): Promise<DashboardPayload> {
  const metrics = await getDashboardData(db, now);
  const today = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  const from = today - (WINDOW - 1) * DAY;

  const rows = await db
    .select({ id: workouts.id, title: workouts.title, start: workouts.startTime, minutes: workouts.durationMin, volume: workouts.volumeKg })
    .from(workouts)
    .where(gte(workouts.startTime, new Date(from)))
    .orderBy(desc(workouts.startTime));

  const exerciseCounts = new Map(
    (
      await db
        .select({ workoutId: workoutExercises.workoutId, n: sql<number>`count(*)::int` })
        .from(workoutExercises)
        .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
        .where(gte(workouts.startTime, new Date(from)))
        .groupBy(workoutExercises.workoutId)
    ).map((r) => [r.workoutId, r.n]),
  );

  // the heaviest main-lift set of each workout, for the activity feed
  const topSets = new Map<string, StrengthDay['topSet']>();
  for (const lift of Object.keys(metrics.lifts) as Lift[]) {
    for (const p of metrics.lifts[lift]) {
      const cur = topSets.get(p.workoutId);
      if (!cur || p.weightKg > cur.weightKg) topSets.set(p.workoutId, { lift, weightKg: p.weightKg, reps: p.reps });
    }
  }

  const byDate = new Map<string, StrengthDay>();
  for (const w of rows) {
    const key = iso(w.start.getTime());
    const prev = byDate.get(key);
    // two sessions on one day are merged; the later one names the day
    byDate.set(key, {
      workoutId: prev?.workoutId ?? w.id,
      title: prev?.title ?? w.title,
      minutes: (prev?.minutes ?? 0) + w.minutes,
      volumeKg: (prev?.volumeKg ?? 0) + w.volume,
      exercises: (prev?.exercises ?? 0) + (exerciseCounts.get(w.id) ?? 0),
      source: 'Hevy',
      topSet: prev?.topSet ?? topSets.get(w.id) ?? null,
    });
  }

  // Apple Health: a metric counts as live once any day in the window has it
  const [health, healthAt] = await Promise.all([healthByDate(iso(from)), lastDelivery()]);
  const has = (...keys: string[]) => [...health.values()].some((d) => keys.some((k) => k in d));
  const live: Live = { sleep: has('sleep_h'), hrv: has('hrv_ms'), steps: has('steps'), nutrition: has('kcal', 'protein_g', 'carbs_g', 'fat_g') };

  const body = metrics.body;
  let bi = 0;
  let weightKg: number | null = null;
  let bodyFat: number | null = null;
  const days: DayRow[] = [];
  for (let i = 0; i < WINDOW; i++) {
    const date = iso(from + i * DAY);
    // carry the latest weigh-in forward; Hevy measurements are often weekly
    while (bi < body.length && body[bi].date <= date) {
      weightKg = body[bi].weightKg ?? weightKg;
      bodyFat = body[bi].fatPercent ?? bodyFat;
      bi++;
    }
    const ah = health.get(date) ?? {};
    // a same-day Apple Health weigh-in (smart scale) wins over the carried-forward one
    weightKg = ah.weight_kg ?? weightKg;
    bodyFat = ah.body_fat_pct ?? bodyFat;
    const strength = byDate.get(date) ?? null;
    const sample = sampleDay(date, i / (WINDOW - 1), !!strength);
    days.push({
      date,
      strength,
      weightKg,
      bodyFat,
      cardio: sample.cardio,
      sleepH: live.sleep ? (ah.sleep_h ?? null) : sample.sleepH,
      hrv: live.hrv ? (ah.hrv_ms ?? null) : sample.hrv,
      steps: live.steps ? (ah.steps ?? null) : sample.steps,
      kcal: live.nutrition ? (ah.kcal ?? null) : sample.kcal,
      protein: live.nutrition ? (ah.protein_g ?? null) : sample.protein,
      carbs: live.nutrition ? (ah.carbs_g ?? null) : sample.carbs,
      fat: live.nutrition ? (ah.fat_g ?? null) : sample.fat,
    });
  }

  const hevyStatus = metrics.sync ? ago(metrics.sync.at, now) + (metrics.sync.mock ? ' · sample data' : '') : 'Not synced yet';
  const sources: SourceStatus[] = [
    { id: 'hevy', name: 'Hevy', via: 'API · workouts, body', connected: !!metrics.sync, status: hevyStatus },
    { id: 'strava', name: 'Strava', via: 'Runs', connected: false, status: 'Sample data' },
    { id: 'oura', name: 'Oura', via: 'Sleep, HRV', connected: false, status: live.sleep ? 'Not connected' : 'Sample data' },
    { id: 'apple-health', name: 'Apple Health', via: 'Sleep, steps, weight', connected: !!healthAt, status: healthAt ? ago(healthAt.toISOString(), now) : 'Not connected' },
    { id: 'nutrition', name: 'Nutrition', via: 'Calories, macros', connected: live.nutrition, status: live.nutrition ? 'Via Apple Health' : 'Sample data' },
  ];

  return {
    generatedAt: new Date(now).toISOString(),
    today: iso(today),
    hevyMock: !!metrics.sync?.mock,
    lastSync: metrics.sync?.at ?? null,
    sources,
    live,
    days,
    lifts: metrics.lifts,
    prs: metrics.prs,
    avatar: metrics.avatar,
  };
}
