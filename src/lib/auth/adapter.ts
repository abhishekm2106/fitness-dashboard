import { and, eq, gte, sql } from 'drizzle-orm';
import type { Adapter, AdapterAccount, AdapterUser } from 'next-auth/adapters';
import { getDb } from '@/db';
import { accounts, users, verificationTokens } from '@/db/schema';

export const MAX_CODE_ATTEMPTS = 5;

const toUser = (u: typeof users.$inferSelect): AdapterUser => ({ ...u, email: u.email ?? '' });

/**
 * Auth.js storage over our own getDb(). Sessions are JWT cookies, so only users,
 * linked accounts and email sign-in codes are stored.
 */
export const adapter: Adapter = {
  // Auth.js passes a throwaway id; the table generates its own
  async createUser(data) {
    const db = await getDb();
    const [u] = await db.insert(users).values({ name: data.name, email: data.email, emailVerified: data.emailVerified, image: data.image }).returning();
    return toUser(u);
  },
  async getUser(id) {
    const [u] = await (await getDb()).select().from(users).where(eq(users.id, id));
    return u ? toUser(u) : null;
  },
  async getUserByEmail(email) {
    const [u] = await (await getDb()).select().from(users).where(eq(users.email, email));
    return u ? toUser(u) : null;
  },
  async getUserByAccount({ provider, providerAccountId }) {
    const [row] = await (await getDb())
      .select({ user: users })
      .from(accounts)
      .innerJoin(users, eq(accounts.userId, users.id))
      .where(and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId)));
    return row ? toUser(row.user) : null;
  },
  async updateUser({ id, ...data }) {
    const [u] = await (await getDb())
      .update(users)
      .set({ name: data.name, email: data.email, emailVerified: data.emailVerified, image: data.image })
      .where(eq(users.id, id))
      .returning();
    return toUser(u);
  },
  async linkAccount(a: AdapterAccount) {
    await (await getDb())
      .insert(accounts)
      .values({
        userId: a.userId,
        type: a.type,
        provider: a.provider,
        providerAccountId: a.providerAccountId,
        refreshToken: a.refresh_token,
        accessToken: a.access_token,
        expiresAt: a.expires_at,
        tokenType: a.token_type,
        scope: a.scope,
        idToken: a.id_token,
        sessionState: typeof a.session_state === 'string' ? a.session_state : null,
      })
      .onConflictDoNothing();
  },
  // a new code replaces any earlier one for the same email
  async createVerificationToken(t) {
    const db = await getDb();
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, t.identifier));
    await db.insert(verificationTokens).values(t);
    return t;
  },
  async useVerificationToken({ identifier, token }) {
    const db = await getDb();
    const [hit] = await db
      .delete(verificationTokens)
      .where(and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, token)))
      .returning({ identifier: verificationTokens.identifier, token: verificationTokens.token, expires: verificationTokens.expires });
    if (hit) return hit;
    // A wrong code: count it, and drop the code once the guesses run out
    await db
      .update(verificationTokens)
      .set({ attempts: sql`${verificationTokens.attempts} + 1` })
      .where(eq(verificationTokens.identifier, identifier));
    await db.delete(verificationTokens).where(and(eq(verificationTokens.identifier, identifier), gte(verificationTokens.attempts, MAX_CODE_ATTEMPTS)));
    return null;
  },
};

/** When the current code for this email was sent, if there is one */
export async function codeSentAt(email: string, maxAgeSeconds: number): Promise<Date | null> {
  const [t] = await (await getDb()).select({ expires: verificationTokens.expires }).from(verificationTokens).where(eq(verificationTokens.identifier, email));
  return t ? new Date(t.expires.getTime() - maxAgeSeconds * 1000) : null;
}
