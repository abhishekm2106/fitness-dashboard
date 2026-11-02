// Stand-in data for sources that aren't connected yet (Strava runs, Oura sleep/HRV, nutrition).
// Seeded by date, so a given day always shows the same numbers. Every card that uses it says so.
import type { CardioDay } from './types';

function seeded(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let s = h >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface SampleDay {
  cardio: CardioDay | null;
  sleepH: number;
  hrv: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** progress runs 0 → 1 across the window, so trends improve gently over time. */
export function sampleDay(date: string, progress: number, trainedToday: boolean): SampleDay {
  const rnd = seeded(date);
  const noise = () => (rnd() + rnd() + rnd() - 1.5) * 1.15;
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay();
  const week = Math.floor(d.getTime() / (7 * 86_400_000));

  let km = 0;
  if (dow === 2) km = 5 + rnd() * 2.4;
  else if (dow === 4) km = 4 + rnd() * 2;
  else if (dow === 6 && week % 2 === 1) km = 10 + rnd() * 4;
  const skip = rnd() < 0.1;
  let cardio: CardioDay | null = null;
  if (km && !skip) {
    const pace = 5.6 - 0.35 * progress + noise() * 0.12;
    cardio = { km: Math.round(km * 10) / 10, minutes: Math.round(km * pace), paceMinPerKm: pace, long: km > 9 };
  }
  const hard = trainedToday || cardio?.long;
  return {
    cardio,
    sleepH: Math.min(8.8, Math.max(5.6, 6.85 + 0.45 * progress + noise() * 0.55 - (dow === 6 ? 0.35 : 0))),
    hrv: Math.round(47 + 10 * progress + noise() * 5 - (hard ? 3 : 0)),
    kcal: Math.round(2230 + (trainedToday ? 160 : 0) + (cardio ? 120 : 0) + noise() * 230),
    protein: Math.round(142 + 12 * progress + noise() * 16),
    carbs: Math.round(230 + noise() * 40 + (trainedToday ? 25 : 0)),
    fat: Math.round(72 + noise() * 12),
  };
}
