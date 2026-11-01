import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { HevyClient, HevyError } from '@/lib/hevy/client';
import { syncHevy } from '@/lib/sync/hevy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel Cron calls GET with "Authorization: Bearer $CRON_SECRET".
// The dashboard's "Sync now" button calls POST; once deployed, set SYNC_SECRET and send it as x-sync-secret.
function authorized(req: Request): boolean {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const secret = process.env.SYNC_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('x-sync-secret') === secret;
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Not authorized to run a sync.' }, { status: 401 });
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
