import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getDashboardData } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getDashboardData(await getDb()));
}
