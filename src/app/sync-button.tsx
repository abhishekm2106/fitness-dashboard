'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './page.module.css';

export default function SyncButton() {
  const router = useRouter();
  const [state, setState] = useState<{ busy: boolean; message?: string }>({ busy: false });

  async function sync() {
    setState({ busy: true });
    const res = await fetch('/api/sync', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState({ busy: false, message: body.error ?? 'Sync failed.' });
      return;
    }
    setState({ busy: false, message: `Synced: ${body.workoutsUpserted} workouts updated, ${body.workoutsDeleted} removed (${body.mode}).` });
    router.refresh();
  }

  return (
    <div className={styles.syncBox}>
      <button type="button" className={styles.button} onClick={sync} disabled={state.busy}>
        {state.busy ? 'Syncing…' : 'Sync now'}
      </button>
      {state.message && (
        <p className={styles.sub} role="status">
          {state.message}
        </p>
      )}
    </div>
  );
}
