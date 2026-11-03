'use client';

import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { Loader2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';

const slot = 'size-12 text-xl font-semibold sm:size-14 sm:text-2xl';

/**
 * Six boxes that accept typing, pasting and the browser's one-time-code autofill; a full code submits itself.
 * It's a plain GET form to Auth.js's email callback, the same check the emailed link goes through.
 */
export function CodeForm({ email, callbackUrl }: { email: string; callbackUrl: string }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} method="get" action="/api/auth/callback/resend" onSubmit={() => setBusy(true)} className="flex flex-col gap-4">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <InputOTP
        name="token"
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        value={code}
        onChange={setCode}
        onComplete={() => form.current?.requestSubmit()}
        autoFocus
        autoComplete="one-time-code"
        aria-label="6-digit sign-in code"
        containerClassName="justify-center"
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} className={slot} />
          <InputOTPSlot index={1} className={slot} />
          <InputOTPSlot index={2} className={slot} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} className={slot} />
          <InputOTPSlot index={4} className={slot} />
          <InputOTPSlot index={5} className={slot} />
        </InputOTPGroup>
      </InputOTP>
      <button
        type="submit"
        disabled={code.length !== 6 || busy}
        className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground transition-colors outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:opacity-50"
      >
        {busy && <Loader2Icon className="size-[18px] animate-spin" aria-hidden />}
        {busy ? 'Checking…' : 'Sign in'}
      </button>
    </form>
  );
}
