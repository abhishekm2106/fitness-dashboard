// A stand-in for api.hevyapp.com used when HEVY_MOCK=1. It answers the same paths with the
// same JSON shapes, generated deterministically: ~4 months of a push/pull/legs/upper split
// with slowly rising strength, plus weekly weigh-ins with body fat trending down.
import type { HevyBodyMeasurement, HevyExerciseTemplate, HevyWorkout, HevyWorkoutEvent } from './types';

const DAY = 86_400_000;

const T = {
  bench: { id: 'mock-79D0BB3A', title: 'Bench Press (Barbell)', type: 'weight_reps', primary_muscle_group: 'chest', secondary_muscle_groups: ['triceps', 'shoulders'], equipment: 'barbell' },
  ohp: { id: 'mock-073032BB', title: 'Overhead Press (Barbell)', type: 'weight_reps', primary_muscle_group: 'shoulders', secondary_muscle_groups: ['triceps'], equipment: 'barbell' },
  incline: { id: 'mock-07B38369', title: 'Incline Bench Press (Dumbbell)', type: 'weight_reps', primary_muscle_group: 'chest', secondary_muscle_groups: ['shoulders'], equipment: 'dumbbell' },
  deadlift: { id: 'mock-C6272009', title: 'Deadlift (Barbell)', type: 'weight_reps', primary_muscle_group: 'lower_back', secondary_muscle_groups: ['hamstrings', 'glutes'], equipment: 'barbell' },
  row: { id: 'mock-55E6546F', title: 'Bent Over Row (Barbell)', type: 'weight_reps', primary_muscle_group: 'upper_back', secondary_muscle_groups: ['biceps'], equipment: 'barbell' },
  pulldown: { id: 'mock-6A6C31A5', title: 'Lat Pulldown (Cable)', type: 'weight_reps', primary_muscle_group: 'lats', secondary_muscle_groups: ['biceps'], equipment: 'machine' },
  squat: { id: 'mock-D04AC939', title: 'Squat (Barbell)', type: 'weight_reps', primary_muscle_group: 'quadriceps', secondary_muscle_groups: ['glutes'], equipment: 'barbell' },
  rdl: { id: 'mock-2B4B7310', title: 'Romanian Deadlift (Barbell)', type: 'weight_reps', primary_muscle_group: 'hamstrings', secondary_muscle_groups: ['glutes'], equipment: 'barbell' },
  legpress: { id: 'mock-C7973E0E', title: 'Leg Press (Machine)', type: 'weight_reps', primary_muscle_group: 'quadriceps', secondary_muscle_groups: ['glutes'], equipment: 'machine' },
  curl: { id: 'mock-37FCC2BB', title: 'Bicep Curl (Dumbbell)', type: 'weight_reps', primary_muscle_group: 'biceps', secondary_muscle_groups: [], equipment: 'dumbbell' },
  raise: { id: 'mock-422B08F1', title: 'Lateral Raise (Dumbbell)', type: 'weight_reps', primary_muscle_group: 'shoulders', secondary_muscle_groups: [], equipment: 'dumbbell' },
} as const;
type Key = keyof typeof T;

// [template, rough 1RM in kg at the start, gain over the period, reps]
const DAYS: Record<number, { title: string; lifts: [Key, number, number, number][] }> = {
  1: { title: 'Push day', lifts: [['bench', 90, 12, 5], ['ohp', 55, 8, 6], ['incline', 32, 4, 10], ['raise', 12, 2, 15]] },
  3: { title: 'Pull day', lifts: [['deadlift', 150, 22, 4], ['row', 85, 10, 8], ['pulldown', 70, 8, 10], ['curl', 18, 3, 12]] },
  5: { title: 'Leg day', lifts: [['squat', 122, 18, 5], ['rdl', 110, 12, 8], ['legpress', 220, 30, 12]] },
  6: { title: 'Upper body', lifts: [['bench', 90, 12, 5], ['ohp', 55, 8, 6], ['row', 85, 10, 8], ['curl', 18, 3, 12]] },
};

function rng(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function build(now: number) {
  const rand = rng(20261031);
  const start = now - 120 * DAY;
  const workouts: HevyWorkout[] = [];
  for (let t = start; t < now - DAY / 2; t += DAY) {
    const d = new Date(t);
    const dow = d.getUTCDay();
    const week = Math.floor((t - start) / (7 * DAY));
    const plan = DAYS[dow];
    if (!plan || (dow === 6 && week % 2) || rand() < 0.1) continue;
    const p = (t - start) / (now - start);
    const begin = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 17, 30);
    const minutes = 52 + Math.floor(rand() * 26);
    const exercises = plan.lifts.map(([key, base, gain, reps], index) => {
      const oneRm = base + gain * p + (rand() - 0.5) * 2;
      const work = Math.round(oneRm / (1 + reps / 30) / 2.5) * 2.5;
      return {
        index,
        title: T[key].title,
        notes: null,
        exercise_template_id: T[key].id,
        superset_id: null,
        sets: [
          { index: 0, type: 'warmup', weight_kg: Math.round(work * 0.5 / 2.5) * 2.5, reps: 10, distance_meters: null, duration_seconds: null, rpe: null, custom_metric: null },
          ...[1, 2, 3].map((i) => ({
            index: i,
            type: 'normal',
            weight_kg: work,
            reps: reps - (i === 3 && rand() < 0.4 ? 1 : 0),
            distance_meters: null,
            duration_seconds: null,
            rpe: i === 3 ? 8.5 : null,
            custom_metric: null,
          })),
        ],
      };
    });
    const end = begin + minutes * 60_000;
    workouts.push({
      id: `mock-w-${d.toISOString().slice(0, 10)}`,
      title: plan.title,
      routine_id: null,
      description: null,
      start_time: new Date(begin).toISOString(),
      end_time: new Date(end).toISOString(),
      created_at: new Date(end).toISOString(),
      updated_at: new Date(end).toISOString(),
      exercises,
    });
  }
  workouts.reverse(); // newest first, like the real API

  const body: HevyBodyMeasurement[] = [];
  for (let t = start; t < now; t += 7 * DAY) {
    const p = (t - start) / (now - start);
    const weight = Math.round((79.3 - 2.2 * p + (rand() - 0.5) * 0.6) * 10) / 10;
    const fat = Math.round((20.6 - 5.4 * p + (rand() - 0.5) * 0.6) * 10) / 10;
    body.push({ date: new Date(t).toISOString().slice(0, 10), weight_kg: weight, fat_percent: fat, lean_mass_kg: Math.round(weight * (1 - fat / 100) * 10) / 10 });
  }
  body.reverse();

  const templates: HevyExerciseTemplate[] = Object.values(T).map((x) => ({ ...x, secondary_muscle_groups: [...x.secondary_muscle_groups], is_custom: false }));
  return { workouts, body, templates };
}

function page<T>(items: T[], url: URL, key: string, max: number) {
  const size = Math.min(max, Number(url.searchParams.get('pageSize') ?? max));
  const n = Number(url.searchParams.get('page') ?? 1);
  return { page: n, page_count: Math.max(1, Math.ceil(items.length / size)), [key]: items.slice((n - 1) * size, n * size) };
}

export async function mockFetch(input: string): Promise<Response> {
  const url = new URL(input);
  const now = Date.now();
  const { workouts, body, templates } = build(now);
  const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });

  switch (url.pathname) {
    case '/v1/user/info':
      return json({ data: { id: 'mock-user', username: 'you', name: 'Sample athlete', url: 'https://hevy.com/user/you', weight_unit: 'kg', distance_unit: 'kilometers', is_pro: true } });
    case '/v1/workouts':
      return json(page(workouts, url, 'workouts', 10));
    case '/v1/workouts/events': {
      // Every incremental sync sees the newest workout as edited (renamed) and one deletion,
      // which exercises both code paths.
      const since = Date.parse(url.searchParams.get('since') ?? '1970-01-01T00:00:00Z');
      const events: HevyWorkoutEvent[] = [];
      if (workouts[0] && since < now) {
        events.push({ type: 'updated', workout: { ...workouts[0], title: `${workouts[0].title} (edited)`, updated_at: new Date(now).toISOString() } });
        events.push({ type: 'deleted', id: 'mock-w-deleted', deleted_at: new Date(now).toISOString() });
      }
      return json(page(events, url, 'events', 10));
    }
    case '/v1/exercise_templates':
      return json(page(templates, url, 'exercise_templates', 100));
    case '/v1/body_measurements':
      return json(page(body, url, 'body_measurements', 10));
    default:
      return new Response('Not found', { status: 404 });
  }
}
