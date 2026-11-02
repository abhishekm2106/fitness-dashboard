// Per-user settings: their shape, defaults and validation, plus the unit formatter built from them.
// Shared by the server (saving) and the client (the dashboard), so nothing here touches the database.

export type WeightUnit = 'kg' | 'lb';
export type DistanceUnit = 'km' | 'mi';
export type RangeDays = 7 | 30 | 90;
export type WeekStart = 'mon' | 'sun';

export interface Goals {
  weeklySessions: number;
  weeklyMinutes: number;
  sleepHours: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Settings {
  goals: Goals;
  units: { weight: WeightUnit; distance: DistanceUnit };
  display: { defaultRange: RangeDays; weekStart: WeekStart };
}

export const DEFAULT_SETTINGS: Settings = {
  goals: { weeklySessions: 4, weeklyMinutes: 240, sleepHours: 8, calories: 2400, protein: 160, carbs: 260, fat: 75 },
  units: { weight: 'kg', distance: 'km' },
  display: { defaultRange: 30, weekStart: 'mon' },
};

// What each goal accepts, used by both the form and the server-side check
export const GOAL_FIELDS: { key: keyof Goals; label: string; unit: string; min: number; max: number; step: number; hint: string }[] = [
  { key: 'weeklySessions', label: 'Sessions per week', unit: 'sessions', min: 1, max: 14, step: 1, hint: 'Lifting and cardio combined. Drives the effort score and the consistency streak.' },
  { key: 'weeklyMinutes', label: 'Training time per week', unit: 'min', min: 30, max: 1200, step: 15, hint: 'Shown as the goal line on the weekly training time chart.' },
  { key: 'sleepHours', label: 'Sleep per night', unit: 'h', min: 5, max: 10, step: 0.25, hint: 'The goal line on the sleep chart and part of the effort score.' },
  { key: 'calories', label: 'Calories per day', unit: 'kcal', min: 1000, max: 6000, step: 50, hint: 'Nutrition card target.' },
  { key: 'protein', label: 'Protein per day', unit: 'g', min: 30, max: 400, step: 5, hint: 'Counts toward the effort score on days you hit it.' },
  { key: 'carbs', label: 'Carbs per day', unit: 'g', min: 0, max: 800, step: 5, hint: 'Nutrition card target.' },
  { key: 'fat', label: 'Fat per day', unit: 'g', min: 0, max: 300, step: 5, hint: 'Nutrition card target.' },
];

const pick = <T,>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/** Fills in defaults and drops anything out of range, so stored or submitted data is always usable. */
export function parseSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Settings, Record<string, unknown>>>;
  const goals = { ...DEFAULT_SETTINGS.goals };
  for (const f of GOAL_FIELDS) {
    const v = Number(r.goals?.[f.key]);
    if (Number.isFinite(v) && v >= f.min && v <= f.max) goals[f.key] = Math.round(v / f.step) * f.step;
  }
  return {
    goals,
    units: {
      weight: pick(r.units?.weight, ['kg', 'lb'] as const, DEFAULT_SETTINGS.units.weight),
      distance: pick(r.units?.distance, ['km', 'mi'] as const, DEFAULT_SETTINGS.units.distance),
    },
    display: {
      defaultRange: pick(Number(r.display?.defaultRange), [7, 30, 90] as const, DEFAULT_SETTINGS.display.defaultRange),
      weekStart: pick(r.display?.weekStart, ['mon', 'sun'] as const, DEFAULT_SETTINGS.display.weekStart),
    },
  };
}

const LB_PER_KG = 2.20462;
const MI_PER_KM = 0.621371;
const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));

export interface Fmt {
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
  /** a lift weight: 102.5 kg, or 226 lb */
  lift: (kg: number) => string;
  liftNum: (kg: number) => number;
  /** body weight, always one decimal */
  body: (kg: number) => string;
  bodyNum: (kg: number) => number;
  /** total volume: 81.9 t, or 180.6k lb */
  volume: (kg: number) => string;
  dist: (km: number) => string;
  distNum: (km: number) => number;
  /** minutes per km to "5:15 /km" or "8:27 /mi" */
  pace: (minPerKm: number) => string;
  /** the small plate jump suggested in advice */
  plate: string;
}

const clock = (min: number) => {
  const s = Math.round(min * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function makeFmt(units: Settings['units']): Fmt {
  const lb = units.weight === 'lb';
  const mi = units.distance === 'mi';
  const liftNum = (kg: number) => (lb ? Math.round(kg * LB_PER_KG) : Math.round(kg * 10) / 10);
  const bodyNum = (kg: number) => Math.round((lb ? kg * LB_PER_KG : kg) * 10) / 10;
  const distNum = (km: number) => Math.round((mi ? km * MI_PER_KM : km) * 10) / 10;
  return {
    weightUnit: units.weight,
    distanceUnit: units.distance,
    lift: (kg) => `${trim(liftNum(kg), 1)} ${units.weight}`,
    liftNum,
    body: (kg) => `${bodyNum(kg).toFixed(1)} ${units.weight}`,
    bodyNum,
    volume: (kg) => (lb ? `${((kg * LB_PER_KG) / 1000).toFixed(1)}k lb` : `${(kg / 1000).toFixed(1)} t`),
    dist: (km) => `${distNum(km).toFixed(1)} ${units.distance}`,
    distNum,
    pace: (minPerKm) => `${clock(mi ? minPerKm / MI_PER_KM : minPerKm)} /${units.distance}`,
    plate: lb ? '5 lb' : '2.5 kg',
  };
}
