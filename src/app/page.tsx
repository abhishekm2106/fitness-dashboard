import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AccountMenu } from '@/components/auth/account-menu';
import { Dashboard } from '@/components/dashboard/dashboard';
import { SyncButton } from '@/components/dashboard/sync-button';
import { getDb } from '@/db';
import { getProfile } from '@/lib/account';
import { getDashboardPayload } from '@/lib/dashboard/build';
import { getSettings } from '@/lib/settings-store';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // middleware already sends signed-out visitors to /login; this keeps the page safe on its own
  const session = await auth();
  if (!session?.user) redirect('/login');
  const [data, settings, profile] = await Promise.all([getDb().then((db) => getDashboardPayload(db)), getSettings(session.user.id), getProfile(session.user.id)]);
  // the stored profile wins, so a name changed in Settings shows up right away
  const account = <AccountMenu user={{ ...session.user, ...(profile && { name: profile.name, image: profile.image ?? session.user.image }) }} />;

  if (!data.lastSync) {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-24">
        <div className="self-end">{account}</div>
        <h1 className="font-display text-[32px] font-bold">Master Dashboard</h1>
        <p className="text-subtle">
          No workouts yet. Sync with Hevy to pull in your history. Without an API key, set <code>HEVY_MOCK=1</code> in <code>.env.local</code> to explore with sample data.
        </p>
        <SyncButton />
      </main>
    );
  }

  return <Dashboard data={data} settings={settings} account={account} />;
}
