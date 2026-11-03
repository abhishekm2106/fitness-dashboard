'use client';

import { RefreshCwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? 'Sync failed.');
        return;
      }
      toast.success(`Synced with Hevy: ${body.workoutsUpserted} workouts updated, ${body.workoutsDeleted} removed.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={sync} disabled={busy} className="h-10 rounded-[10px] font-semibold">
      <RefreshCwIcon className={busy ? 'animate-spin' : undefined} aria-hidden />
      {busy ? 'Syncing…' : 'Sync now'}
    </Button>
  );
}
