import { CircleAlertIcon, InfoIcon } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import s from './login.module.css';

// The sign-in pages' frame: the neon stage on one side, the form on the other
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={s.page}>
      <div className={s.shell}>
        <div className={s.stage} aria-hidden="true">
          <div className={s.hud}>
            <div className={s.eyebrow}>Training · Recovery · Nutrition</div>
            <div className="font-display text-[28px] leading-tight font-bold">Ready when you are</div>
            <div className={s.bars} />
          </div>
          <div className={s.floor} />
          <div className={s.fig}>
            <Image src="/avatar/toned-thumbs.png" alt="" fill sizes="400px" priority />
          </div>
          <span className={s.spark} style={{ left: '14%', top: '38%' }} />
          <span className={s.spark} style={{ left: '80%', top: '30%', animationDelay: '.8s' }} />
          <span className={s.spark} style={{ left: '72%', top: '62%', width: 11, height: 11, animationDelay: '1.6s' }} />
        </div>
        <div className={s.panel}>{children}</div>
      </div>
    </main>
  );
}

export function AuthAlert({ children, tone = 'bad' }: { children: React.ReactNode; tone?: 'bad' | 'info' }) {
  const Icon = tone === 'bad' ? CircleAlertIcon : InfoIcon;
  return (
    <div
      role={tone === 'bad' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm', tone === 'bad' ? 'border-bad/40 bg-bad/10' : 'border-primary/30 bg-primary/10')}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', tone === 'bad' ? 'text-bad' : 'text-primary')} aria-hidden />
      <div>{children}</div>
    </div>
  );
}
