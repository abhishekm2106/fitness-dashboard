import type { LiftPoint, PrEvent } from '@/lib/metrics';

export type Lift = 'bench' | 'squat' | 'deadlift' | 'ohp';
export type { LiftPoint, PrEvent };

export interface StrengthDay {
  workoutId: string;
  title: string;
  minutes: number;
  volumeKg: number;
  exercises: number;
  source: 'Hevy';
  topSet: { lift: Lift; weightKg: number; reps: number } | null;
}

export interface CardioDay {
  km: number;
  minutes: number;
  paceMinPerKm: number;
  long: boolean;
}

/**
 * One calendar day. Strength comes from Hevy, body from Hevy and Apple Health. Recovery, steps and
 * nutrition come from Apple Health once it delivers them, and are labelled samples until then.
 * A null means a connected source had nothing for that day, so it's left out of averages.
 */
export interface DayRow {
  date: string; // YYYY-MM-DD (UTC)
  strength: StrengthDay | null;
  weightKg: number | null; // latest weigh-in on or before this day
  bodyFat: number | null;
  cardio: CardioDay | null;
  sleepH: number | null;
  hrv: number | null;
  steps: number | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

/** Which areas show real data rather than samples */
export interface Live {
  sleep: boolean;
  hrv: boolean;
  steps: boolean;
  nutrition: boolean;
}

export interface SourceStatus {
  id: 'hevy' | 'lyfta' | 'apple-health' | 'strava' | 'oura' | 'nutrition';
  name: string;
  via: string;
  connected: boolean;
  status: string;
}

export interface DashboardPayload {
  generatedAt: string;
  today: string;
  hevyMock: boolean;
  lastSync: string | null;
  sources: SourceStatus[];
  live: Live;
  days: DayRow[];
  lifts: Record<Lift, LiftPoint[]>;
  prs: PrEvent[];
  avatar: { bodyFatPercent: number | null; weightKg: number | null; benchToBodyweight: number | null; muscle: number; mode: string };
}
