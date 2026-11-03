import { asc, desc, eq, inArray } from 'drizzle-orm';
import type { DB } from '@/db';
import { bodyMeasurements, healthMetrics, workoutExercises, workouts, workoutSets } from '@/db/schema';
import type { Metric } from '@/lib/apple-health/parse';
import { SOURCE as APPLE_HEALTH } from '@/lib/apple-health/store';

// Everything stored from each source, for the per-source data pages

export interface HevySet {
  index: number;
  type: string;
  weightKg: number | null;
  reps: number | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  rpe: number | null;
  e1rmKg: number | null;
}
export interface HevyWorkout {
  id: string;
  title: string;
  start: string;
  minutes: number;
  volumeKg: number;
  exercises: { title: string; notes: string | null; sets: HevySet[] }[];
}
export interface HevyData {
  workouts: HevyWorkout[];
  body: { date: string; weightKg: number | null; fatPercent: number | null; leanMassKg: number | null }[];
}

export async function getHevyData(db: DB): Promise<HevyData> {
  const ws = await db
    .select({ id: workouts.id, title: workouts.title, start: workouts.startTime, minutes: workouts.durationMin, volumeKg: workouts.volumeKg })
    .from(workouts)
    .orderBy(desc(workouts.startTime));
  const ids = ws.map((w) => w.id);
  const ex = ids.length
    ? await db
        .select({ id: workoutExercises.id, workoutId: workoutExercises.workoutId, index: workoutExercises.index, title: workoutExercises.title, notes: workoutExercises.notes })
        .from(workoutExercises)
        .where(inArray(workoutExercises.workoutId, ids))
        .orderBy(asc(workoutExercises.index))
    : [];
  const sets = ex.length
    ? await db
        .select()
        .from(workoutSets)
        .where(
          inArray(
            workoutSets.exerciseId,
            ex.map((e) => e.id),
          ),
        )
        .orderBy(asc(workoutSets.index))
    : [];

  const setsBy = new Map<number, HevySet[]>();
  for (const s of sets) {
    const list = setsBy.get(s.exerciseId) ?? [];
    list.push({ index: s.index, type: s.type, weightKg: s.weightKg, reps: s.reps, distanceMeters: s.distanceMeters, durationSeconds: s.durationSeconds, rpe: s.rpe, e1rmKg: s.e1rmKg });
    setsBy.set(s.exerciseId, list);
  }
  const exBy = new Map<string, HevyWorkout['exercises']>();
  for (const e of ex) {
    const list = exBy.get(e.workoutId) ?? [];
    list.push({ title: e.title, notes: e.notes, sets: setsBy.get(e.id) ?? [] });
    exBy.set(e.workoutId, list);
  }

  const body = await db
    .select({ date: bodyMeasurements.date, weightKg: bodyMeasurements.weightKg, fatPercent: bodyMeasurements.fatPercent, leanMassKg: bodyMeasurements.leanMassKg })
    .from(bodyMeasurements)
    .orderBy(desc(bodyMeasurements.date));

  return {
    workouts: ws.map((w) => ({ ...w, start: w.start.toISOString(), exercises: exBy.get(w.id) ?? [] })),
    body,
  };
}

/** metric → newest-first list of daily values */
export type AppleHealthData = Partial<Record<Metric, { date: string; value: number }[]>>;

export async function getAppleHealthData(db: DB): Promise<AppleHealthData> {
  const rows = await db
    .select({ date: healthMetrics.date, metric: healthMetrics.metric, value: healthMetrics.value })
    .from(healthMetrics)
    .where(eq(healthMetrics.source, APPLE_HEALTH))
    .orderBy(desc(healthMetrics.date));
  const out: AppleHealthData = {};
  for (const r of rows) (out[r.metric as Metric] ??= []).push({ date: r.date, value: r.value });
  return out;
}
