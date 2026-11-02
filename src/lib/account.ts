import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { accounts, users } from '@/db/schema';

export interface Profile {
  name: string | null;
  email: string | null;
  image: string | null;
  /** Google, Apple: the logins linked to this user */
  providers: string[];
}

/** The stored profile; names edited in Settings live here, not in the session cookie */
export async function getProfile(userId: string | undefined): Promise<Profile | null> {
  if (!userId) return null;
  const db = await getDb();
  const [u] = await db.select({ name: users.name, email: users.email, image: users.image }).from(users).where(eq(users.id, userId));
  if (!u) return null;
  const linked = await db.select({ provider: accounts.provider }).from(accounts).where(eq(accounts.userId, userId));
  return { ...u, providers: linked.map((a) => a.provider) };
}
