import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { healthMetrics, sourceConnections } from '@/db/schema';
import type { Metric, ParsedValue, ParseSummary } from './parse';

export const SOURCE = 'apple-health';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export interface Connection {
  connectedAt: Date;
  lastReceivedAt: Date | null;
  lastSummary: (ParseSummary & { at: string }) | null;
  lastError: string | null;
  secretHint: string | null;
}

export async function getConnection(userId: string | undefined): Promise<Connection | null> {
  if (!userId) return null;
  const [c] = await (await getDb())
    .select()
    .from(sourceConnections)
    .where(and(eq(sourceConnections.userId, userId), eq(sourceConnections.source, SOURCE)));
  return c ? { connectedAt: c.connectedAt, lastReceivedAt: c.lastReceivedAt, lastSummary: c.lastSummary as Connection['lastSummary'], lastError: c.lastError, secretHint: c.secretHint } : null;
}

/** Makes a new token (replacing any old one) and returns it; only its hash is kept */
export async function issueToken(userId: string): Promise<string> {
  const token = `mdah_${randomBytes(24).toString('base64url')}`;
  await (await getDb())
    .insert(sourceConnections)
    .values({ userId, source: SOURCE, secretHash: hash(token), secretHint: token.slice(-4) })
    .onConflictDoUpdate({ target: [sourceConnections.userId, sourceConnections.source], set: { secretHash: hash(token), secretHint: token.slice(-4) } });
  return token;
}

/** Removes the connection and the data it delivered */
export async function disconnect(userId: string) {
  const db = await getDb();
  await db.delete(sourceConnections).where(and(eq(sourceConnections.userId, userId), eq(sourceConnections.source, SOURCE)));
  await db.delete(healthMetrics).where(eq(healthMetrics.source, SOURCE));
}

export async function userForToken(token: string): Promise<string | null> {
  const [c] = await (await getDb())
    .select({ userId: sourceConnections.userId })
    .from(sourceConnections)
    .where(and(eq(sourceConnections.source, SOURCE), eq(sourceConnections.secretHash, hash(token))));
  return c?.userId ?? null;
}

export async function saveDelivery(userId: string, values: ParsedValue[], summary: ParseSummary) {
  const db = await getDb();
  for (let i = 0; i < values.length; i += 500) {
    await db
      .insert(healthMetrics)
      .values(values.slice(i, i + 500).map((v) => ({ ...v, source: SOURCE })))
      .onConflictDoUpdate({ target: [healthMetrics.date, healthMetrics.metric], set: { value: sql`excluded.value`, source: SOURCE, updatedAt: new Date() } });
  }
  await db
    .update(sourceConnections)
    .set({ lastReceivedAt: new Date(), lastSummary: { ...summary, at: new Date().toISOString() }, lastError: null })
    .where(and(eq(sourceConnections.userId, userId), eq(sourceConnections.source, SOURCE)));
}

export async function recordError(userId: string, message: string) {
  await (await getDb())
    .update(sourceConnections)
    .set({ lastError: message.slice(0, 300) })
    .where(and(eq(sourceConnections.userId, userId), eq(sourceConnections.source, SOURCE)));
}

/** Every stored value from a date on, as date → metric → value */
export async function healthByDate(from: string): Promise<Map<string, Partial<Record<Metric, number>>>> {
  const rows = await (await getDb())
    .select({ date: healthMetrics.date, metric: healthMetrics.metric, value: healthMetrics.value })
    .from(healthMetrics)
    .where(and(eq(healthMetrics.source, SOURCE), gte(healthMetrics.date, from)));
  const out = new Map<string, Partial<Record<Metric, number>>>();
  for (const r of rows) {
    const d = out.get(r.date) ?? {};
    d[r.metric as Metric] = r.value;
    out.set(r.date, d);
  }
  return out;
}

/** When the most recent delivery arrived (this is a single-person dashboard) */
export async function lastDelivery(): Promise<Date | null> {
  const [r] = await (await getDb())
    .select({ at: sql<Date | null>`max(${sourceConnections.lastReceivedAt})` })
    .from(sourceConnections)
    .where(eq(sourceConnections.source, SOURCE));
  return r?.at ? new Date(r.at) : null;
}
