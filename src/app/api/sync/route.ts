import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { HevyClient, HevyError } from '@/lib/hevy/client';
import { syncHevy } from '@/lib/sync/hevy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel Cron calls GET with "Authorization: Bearer $CRON_SECRET".
// The dashboard's "Sync now" button calls POST with the signed-in session.
// Scripts can send SYNC_SECRET as x-sync-secret.
async function authorized(req: Request): Promise<boolean> {
  const header = req.headers.get('authorization');
  if (process.env.CRON_SECRET && header === `Bearer ${process.env.CRON_SECRET}`) return true;
  const secret = process.env.SYNC_SECRET;
  if (secret && req.headers.get('x-sync-secret') === secret) return true;
  return !!(await auth())?.user;
}

async function run(req: Request) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Not authorized to run a sync.' }, { status: 401 });
  try {
    const result = await syncHevy(await getDb(), HevyClient.fromEnv());
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof HevyError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Sync failed.' }, { status });
  }
}

export const GET = run;
export const POST = run;
