'use client';

import { Loader2Icon, MailIcon } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground transition-colors outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:opacity-60"
    >
      {pending ? <Loader2Icon className="size-[18px] animate-spin" aria-hidden /> : <MailIcon className="size-[18px]" aria-hidden />}
      {pending ? 'Sending…' : 'Email me a code'}
    </button>
  );
}

export function EmailForm({ action, redirectTo }: { action: (fd: FormData) => Promise<void>; redirectTo: string }) {
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Label htmlFor="email" className="text-sm text-subtle">
        Email
      </Label>
      <Input id="email" name="email" type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" className="h-12 rounded-xl px-4 text-[15px]" />
      <SendButton />
    </form>
  );
}
