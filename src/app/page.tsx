import { Dashboard } from '@/components/dashboard/dashboard';
import { SyncButton } from '@/components/dashboard/sync-button';
import { getDb } from '@/db';
import { getDashboardPayload } from '@/lib/dashboard/build';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const data = await getDashboardPayload(await getDb());

  if (!data.lastSync) {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-24">
        <h1 className="font-display text-[32px] font-bold">Master Dashboard</h1>
        <p className="text-subtle">
          No workouts yet. Sync with Hevy to pull in your history. Without an API key, set <code>HEVY_MOCK=1</code> in <code>.env.local</code> to explore with sample data.
        </p>
        <SyncButton />
      </main>
    );
  }

  return <Dashboard data={data} />;
}
