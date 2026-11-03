import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { userSettings } from '@/db/schema';
import { DEFAULT_SETTINGS, parseSettings, type Settings } from './settings';

export async function getSettings(userId: string | undefined): Promise<Settings> {
  if (!userId) return DEFAULT_SETTINGS;
  const [row] = await (await getDb()).select({ data: userSettings.data }).from(userSettings).where(eq(userSettings.userId, userId));
  return parseSettings(row?.data);
}

/** Merges one section's changes into the saved settings and returns the result */
export async function updateSettings(userId: string, patch: { [K in keyof Settings]?: Partial<Settings[K]> }): Promise<Settings> {
  const cur = await getSettings(userId);
  const next = parseSettings({
    goals: { ...cur.goals, ...patch.goals },
    units: { ...cur.units, ...patch.units },
    display: { ...cur.display, ...patch.display },
  });
  await (await getDb())
    .insert(userSettings)
    .values({ userId, data: next })
    .onConflictDoUpdate({ target: userSettings.userId, set: { data: next, updatedAt: new Date() } });
  return next;
}
