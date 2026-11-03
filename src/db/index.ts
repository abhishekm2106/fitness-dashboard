import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema';

export type DB = PostgresJsDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), 'drizzle');

// One connection per server process; survives Next.js hot reloads in dev.
const globalForDb = globalThis as unknown as { dbPromise?: Promise<DB> };

/**
 * DATABASE_URL set (Supabase/Neon/any Postgres) → postgres-js.
 * Not set → an embedded Postgres (PGlite) in ./.data, so the app runs with zero setup.
 * Both are migrated on first use.
 */
export function getDb(): Promise<DB> {
  globalForDb.dbPromise ??= connect();
  return globalForDb.dbPromise;
}

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    // prepare:false keeps Supabase's transaction pooler (port 6543) happy
    const client = postgres(url, { prepare: false, max: 5 });
    const db = drizzlePostgres(client, { schema });
    await migratePostgres(db, { migrationsFolder: MIGRATIONS });
    return db;
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');
  const { migrate: migratePglite } = await import('drizzle-orm/pglite/migrator');
  const dir = path.join(process.cwd(), '.data');
  await mkdir(dir, { recursive: true });
  const client = new PGlite(path.join(dir, 'pglite'));
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  // Same query API; the two drivers differ only in their result wrappers.
  return db as unknown as DB;
}
