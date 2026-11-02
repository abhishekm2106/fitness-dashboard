import { HeartIcon, SaladIcon } from 'lucide-react';
import { siHevy, siStrava } from 'simple-icons';
import type { SourceId } from '@/lib/sources';
import { cn } from '@/lib/utils';

// Hevy and Strava use their official marks (simple-icons, CC0). Apple Health uses its app's look
// (a red heart on white) rather than the Apple logo. Oura and Lyfta have no open mark, so they get
// wordmark-style tiles until official artwork is added.
function Mark({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[55%]" fill="currentColor">
      <path d={path} />
    </svg>
  );
}

const TILES: Record<SourceId, { className: string; content: React.ReactNode }> = {
  hevy: { className: 'bg-black text-white ring-1 ring-white/15', content: <Mark path={siHevy.path} /> },
  strava: { className: 'bg-[#FC4C02] text-white', content: <Mark path={siStrava.path} /> },
  oura: {
    className: 'bg-[#0b0b0c] text-[#e9e7e2] ring-1 ring-white/15',
    content: <span className="font-display text-[0.27em] font-semibold tracking-[0.1em]">ŌURA</span>,
  },
  'apple-health': { className: 'bg-white', content: <HeartIcon aria-hidden className="size-[55%] fill-[#ff2d55] text-[#ff2d55]" /> },
  nutrition: { className: 'bg-[#1f8f4e] text-white', content: <SaladIcon aria-hidden className="size-[52%]" /> },
  lyfta: { className: 'bg-[#1b1b1a] text-white ring-1 ring-white/15', content: <span className="font-display text-[0.5em] font-extrabold italic">L</span> },
};

export function SourceLogo({ id, size = 48, className }: { id: SourceId; size?: number; className?: string }) {
  const t = TILES[id];
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size }}
      className={cn('grid shrink-0 place-items-center overflow-hidden rounded-[22%] leading-none', t.className, className)}
    >
      {t.content}
    </span>
  );
}
