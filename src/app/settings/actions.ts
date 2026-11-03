'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings';
import { updateSettings } from '@/lib/settings-store';
import { inRange, type Metric, type ParsedValue, type ParseSummary } from '@/lib/apple-health/parse';
import { disconnect, getStatus, issueToken, markDelivered, saveValues } from '@/lib/apple-health/store';
import type { AppleHealthStatus } from '@/lib/apple-health/status';

type Result = { ok: true; settings?: Settings } | { ok: false; error: string };

async function userId(): Promise<string | null> {
  return (await auth())?.user?.id ?? null;
}

// Values are re-checked by parseSettings; anything out of range falls back to the saved value
async function save(patch: Parameters<typeof updateSettings>[1]): Promise<Result> {
  const id = await userId();
  if (!id) return { ok: false, error: 'Your session has expired. Sign in again.' };
  try {
    const settings = await updateSettings(id, patch);
    revalidatePath('/');
    return { ok: true, settings };
  } catch {
    return { ok: false, error: 'Couldn’t save. Sign out and back in, then try again.' };
  }
}

export async function saveGoals(goals: Partial<Settings['goals']>) {
  return save({ goals });
}

export async function resetGoals() {
  return save({ goals: DEFAULT_SETTINGS.goals });
}

export async function saveDisplay(patch: { units?: Partial<Settings['units']>; display?: Partial<Settings['display']> }) {
  return save(patch);
}

export async function saveName(name: string): Promise<Result> {
  const id = await userId();
  if (!id) return { ok: false, error: 'Your session has expired. Sign in again.' };
  const clean = name.trim().slice(0, 80);
  if (!clean) return { ok: false, error: 'Enter a name.' };
  await (await getDb()).update(users).set({ name: clean }).where(eq(users.id, id));
  revalidatePath('/settings');
  return { ok: true };
}

// --- Apple Health (Health Auto Export) ---

/** Creates the connection, or replaces its token; the token is returned once and never stored */
export async function issueAppleHealthToken(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const id = await userId();
  if (!id) return { ok: false, error: 'Your session has expired. Sign in again.' };
  const token = await issueToken(id);
  revalidatePath('/settings');
  return { ok: true, token };
}

export async function disconnectAppleHealth(): Promise<Result> {
  const id = await userId();
  if (!id) return { ok: false, error: 'Your session has expired. Sign in again.' };
  await disconnect(id);
  revalidatePath('/settings');
  revalidatePath('/');
  return { ok: true };
}

/** Polled by the setup guide while it waits for the phone's first delivery */
export async function appleHealthStatus(): Promise<AppleHealthStatus | null> {
  return getStatus((await userId()) ?? undefined);
}

const METRICS = new Set<Metric>(['steps', 'weight_kg', 'body_fat_pct', 'sleep_h', 'hrv_ms', 'resting_hr', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'active_kcal']);

/**
 * Daily values read from an uploaded Apple Health export in the browser. Sent in chunks; the last
 * chunk carries the summary that the Settings card shows. Each value is checked again here.
 */
export async function importAppleHealthExport(values: ParsedValue[], summary: ParseSummary | null): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  const id = await userId();
  if (!id) return { ok: false, error: 'Your session has expired. Sign in again.' };
  if (!Array.isArray(values) || values.length > 5000) return { ok: false, error: 'Too many values in one request.' };
  const clean = values.filter(
    (v) => v && typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.date) && METRICS.has(v.metric) && typeof v.value === 'number' && inRange(v.metric, v.value),
  );
  await saveValues(clean.map((v) => ({ date: v.date, metric: v.metric, value: v.value })));
  if (summary) {
    const days = Number(summary.days) || 0;
    await markDelivered(id, {
      points: Number(summary.points) || 0,
      days,
      from: typeof summary.from === 'string' ? summary.from.slice(0, 10) : null,
      to: typeof summary.to === 'string' ? summary.to.slice(0, 10) : null,
      metrics: Object.fromEntries(Object.entries(summary.metrics ?? {}).filter(([m, n]) => METRICS.has(m as Metric) && typeof n === 'number')),
      unknown: [],
      via: 'export-file',
    });
    revalidatePath('/');
    revalidatePath('/settings');
  }
  return { ok: true, saved: clean.length };
}
