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

/** One calendar day. Strength and body come from Hevy; the rest are labelled samples until those sources connect. */
export interface DayRow {
  date: string; // YYYY-MM-DD (UTC)
  strength: StrengthDay | null;
  weightKg: number | null; // latest Hevy weigh-in on or before this day
  bodyFat: number | null;
  // sample sources
  cardio: CardioDay | null;
  sleepH: number;
  hrv: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
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
  days: DayRow[];
  lifts: Record<Lift, LiftPoint[]>;
  prs: PrEvent[];
  avatar: { bodyFatPercent: number | null; weightKg: number | null; benchToBodyweight: number | null; muscle: number; mode: string };
}
