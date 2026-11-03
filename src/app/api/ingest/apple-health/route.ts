import { NextResponse } from 'next/server';
import { ParseError, parseDelivery } from '@/lib/apple-health/parse';
import { recordError, saveDelivery, userForToken } from '@/lib/apple-health/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Health Auto Export's "REST API" automation posts Health Metrics JSON here, and a Shortcuts
// automation posts flat day objects; both send the token from Settings as "Authorization: Bearer …".
function tokenFrom(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return req.headers.get('x-api-key')?.trim() || null;
}

export async function POST(req: Request) {
  const token = tokenFrom(req);
  const userId = token ? await userForToken(token) : null;
  if (!userId) return NextResponse.json({ error: 'Unknown or missing token. Copy it again from Settings → Data sources → Apple Health.' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await recordError(userId, 'The delivery wasn’t valid JSON. In Health Auto Export set Export Format to JSON; in Shortcuts set Request Body to JSON.');
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  try {
    const { values, summary, via } = parseDelivery(body);
    await saveDelivery(userId, values, { ...summary, via });
    return NextResponse.json({ ok: true, saved: values.length, days: summary.days, unrecognised: summary.unknown });
  } catch (err) {
    const message = err instanceof ParseError ? err.message : 'Couldn’t store the delivery.';
    await recordError(userId, message);
    return NextResponse.json({ error: message }, { status: err instanceof ParseError ? 400 : 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: 'Send Health JSON with POST.' }, { status: 405 });
}
