'use client';

import { Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { saveName } from '@/app/settings/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function NameForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [name, setName] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = name.trim() !== saved && name.trim() !== '';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveName(name);
          if (!res.ok) return void toast.error(res.error);
          setSaved(name.trim());
          toast.success('Name updated');
          router.refresh();
        });
      }}
      className="flex flex-col gap-1.5"
    >
      <Label htmlFor="name" className="text-sm">
        Display name
      </Label>
      <div className="flex gap-2">
        <Input id="name" value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} className="h-10 max-w-[320px] rounded-[10px]" />
        <Button type="submit" variant="outline" disabled={!dirty || pending} className="h-10 rounded-[10px]">
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          Save
        </Button>
      </div>
    </form>
  );
}
