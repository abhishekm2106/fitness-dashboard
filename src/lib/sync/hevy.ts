import { eq, inArray, sql } from 'drizzle-orm';
import type { DB } from '@/db';
import { bodyMeasurements, exerciseTemplates, syncState, workoutExercises, workouts, workoutSets } from '@/db/schema';
import type { HevyClient } from '@/lib/hevy/client';
import type { HevyWorkout } from '@/lib/hevy/types';

const SINCE_KEY = 'hevy.workouts.since';
const LAST_SYNC_KEY = 'hevy.lastSync';
// overlap each incremental window a little so an edit made mid-sync is never missed
const OVERLAP_MS = 5 * 60_000;

export interface SyncResult {
  mode: 'full' | 'incremental';
  mock: boolean;
  templates: number;
  workoutsUpserted: number;
  workoutsDeleted: number;
  bodyMeasurements: number;
  startedAt: string;
  finishedAt: string;
}

const WORKING_SETS = new Set(['normal', 'failure', 'dropset']);

export function epley(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || !reps || reps < 1 || reps > 12) return null;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

async function getState(db: DB, key: string): Promise<string | null> {
  const [row] = await db.select().from(syncState).where(eq(syncState.key, key));
  return row?.value ?? null;
}

async function setState(db: DB, key: string, value: string) {
  await db
    .insert(syncState)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: syncState.key, set: { value, updatedAt: new Date() } });
}

/** Replaces one workout and all its exercises and sets. */
export async function upsertWorkout(db: DB, w: HevyWorkout) {
  let volume = 0;
  for (const ex of w.exercises) {
    for (const s of ex.sets) if (WORKING_SETS.has(s.type) && s.weight_kg && s.reps) volume += s.weight_kg * s.reps;
  }
  const row = {
    id: w.id,
    source: 'hevy',
    title: w.title,
    description: w.description,
    routineId: w.routine_id,
    startTime: new Date(w.start_time),
    endTime: new Date(w.end_time),
    createdAt: new Date(w.created_at),
    updatedAt: new Date(w.updated_at),
    volumeKg: Math.round(volume),
    durationMin: Math.max(0, Math.round((Date.parse(w.end_time) - Date.parse(w.start_time)) / 60_000)),
  };
  await db.transaction(async (tx) => {
    await tx.insert(workouts).values(row).onConflictDoUpdate({ target: workouts.id, set: row });
    // exercises cascade to their sets
    await tx.delete(workoutExercises).where(eq(workoutExercises.workoutId, w.id));
    for (const ex of w.exercises) {
      const [inserted] = await tx
        .insert(workoutExercises)
        .values({ workoutId: w.id, index: ex.index, title: ex.title, exerciseTemplateId: ex.exercise_template_id, notes: ex.notes, supersetId: ex.superset_id })
        .returning({ id: workoutExercises.id });
      if (!ex.sets.length) continue;
      await tx.insert(workoutSets).values(
        ex.sets.map((s) => ({
          exerciseId: inserted.id,
          index: s.index,
          type: s.type,
          weightKg: s.weight_kg,
          reps: s.reps,
          distanceMeters: s.distance_meters,
          durationSeconds: s.duration_seconds,
          rpe: s.rpe,
          e1rmKg: WORKING_SETS.has(s.type) ? epley(s.weight_kg, s.reps) : null,
        })),
      );
    }
  });
}

/**
 * First run: pulls the full workout history. Later runs: only the change feed since the last run.
 * Templates and body measurements are small, so they are refreshed in full each time.
 */
export async function syncHevy(db: DB, client: HevyClient): Promise<SyncResult> {
  const startedAt = new Date();
  let templates = 0;
  for await (const t of client.exerciseTemplates()) {
    const row = {
      id: t.id,
      title: t.title,
      type: t.type,
      primaryMuscleGroup: t.primary_muscle_group,
      secondaryMuscleGroups: t.secondary_muscle_groups ?? [],
      equipment: t.equipment,
      isCustom: t.is_custom,
    };
    await db.insert(exerciseTemplates).values(row).onConflictDoUpdate({ target: exerciseTemplates.id, set: row });
    templates++;
  }

  const since = await getState(db, SINCE_KEY);
  let upserted = 0;
  let deleted = 0;
  if (!since) {
    for await (const w of client.workouts()) {
      await upsertWorkout(db, w);
      upserted++;
    }
  } else {
    const gone: string[] = [];
    for await (const e of client.workoutEvents(since)) {
      if (e.type === 'updated') {
        await upsertWorkout(db, e.workout);
        upserted++;
      } else if (e.type === 'deleted') {
        gone.push(e.id);
      }
    }
    if (gone.length) {
      const removed = await db.delete(workouts).where(inArray(workouts.id, gone)).returning({ id: workouts.id });
      deleted = removed.length;
    }
  }

  let body = 0;
  for await (const m of client.bodyMeasurements()) {
    const { date, weight_kg, lean_mass_kg, fat_percent, ...rest } = m;
    const row = { date, source: 'hevy', weightKg: weight_kg, leanMassKg: lean_mass_kg, fatPercent: fat_percent, raw: rest };
    await db.insert(bodyMeasurements).values(row).onConflictDoUpdate({ target: bodyMeasurements.date, set: row });
    body++;
  }

  const finishedAt = new Date();
  await setState(db, SINCE_KEY, new Date(startedAt.getTime() - OVERLAP_MS).toISOString());
  await setState(db, LAST_SYNC_KEY, JSON.stringify({ at: finishedAt.toISOString(), mock: client.isMock, upserted, deleted }));

  return {
    mode: since ? 'incremental' : 'full',
    mock: client.isMock,
    templates,
    workoutsUpserted: upserted,
    workoutsDeleted: deleted,
    bodyMeasurements: body,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  };
}

export async function lastSync(db: DB): Promise<{ at: string; mock: boolean } | null> {
  const v = await getState(db, LAST_SYNC_KEY);
  return v ? JSON.parse(v) : null;
}

export async function workoutCount(db: DB): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(workouts);
  return r?.n ?? 0;
}
