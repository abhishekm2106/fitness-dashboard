import { LogOutIcon, SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { signOut } from '@/auth';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type User = { name?: string | null; email?: string | null; image?: string | null };

export function AccountMenu({ user }: { user: User }) {
  const label = user.name || user.email || 'Signed in';
  return (
    <div className="flex h-10 items-center gap-2 rounded-[10px] border border-input bg-input/30 pr-1 pl-1.5">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote profile photo from the OAuth provider
        <img src={user.image} alt="" referrerPolicy="no-referrer" className="size-7 rounded-full" />
      ) : (
        <span aria-hidden className="grid size-7 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="max-w-[160px] truncate text-sm font-medium" title={user.email ?? undefined}>
        {label}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon-sm">
            <Link href="/settings" aria-label="Settings">
              <SettingsIcon aria-hidden />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/login' });
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="submit" variant="ghost" size="icon-sm" aria-label="Sign out">
              <LogOutIcon aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sign out</TooltipContent>
        </Tooltip>
      </form>
    </div>
  );
}
