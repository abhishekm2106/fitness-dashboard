'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings';
import { updateSettings } from '@/lib/settings-store';
import { disconnect, issueToken } from '@/lib/apple-health/store';

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
