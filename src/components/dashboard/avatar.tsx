'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { artFor, type WeekSummary } from '@/lib/dashboard/compute';
import { cn } from '@/lib/utils';
import s from './avatar.module.css';
import { Segmented } from './ui-bits';

type Act = 'idle' | 'run' | 'curl' | 'flex' | 'thumbs' | 'rest';
type Build = 'you' | 'skinny' | 'toned' | 'bodybuilder' | 'heavy';

const LABEL: Record<Act, string> = { idle: 'Standing by', run: 'Jogging', curl: 'Dumbbell curls', flex: 'Flexing', thumbs: 'Thumbs up', rest: 'Taking it easy' };
const BUILDS: { value: Build; label: string }[] = [
  { value: 'you', label: 'You' },
  { value: 'skinny', label: 'Skinny' },
  { value: 'toned', label: 'Toned' },
  { value: 'bodybuilder', label: 'Bodybuilder' },
  { value: 'heavy', label: 'Heavy' },
];
const ACTS: { value: 'auto' | Act; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'idle', label: 'Stand' },
  { value: 'run', label: 'Jog' },
  { value: 'curl', label: 'Curls' },
  { value: 'flex', label: 'Flex' },
  { value: 'thumbs', label: 'Thumbs up' },
  { value: 'rest', label: 'Rest' },
];

// pose image, the act it belongs to, and the frame-swap class for two-frame poses
const FRAMES: { pose: string; act: Act; swap?: keyof typeof s }[] = [
  { pose: 'idle', act: 'idle' },
  { pose: 'idle-blink', act: 'idle', swap: 'blink' },
  { pose: 'run', act: 'run' },
  { pose: 'curl-down', act: 'curl', swap: 'curlDown' },
  { pose: 'curl-up', act: 'curl', swap: 'curlUp' },
  { pose: 'flex-a', act: 'flex', swap: 'flexA' },
  { pose: 'flex-b', act: 'flex', swap: 'flexB' },
  { pose: 'thumbs', act: 'thumbs' },
  { pose: 'rest', act: 'rest' },
];

const autoPlan = (score: number): Act[] => (score >= 70 ? ['run', 'curl', 'flex', 'thumbs'] : score >= 45 ? ['idle', 'run', 'curl'] : ['rest']);

export function AvatarCard({
  mode,
  bodyFat,
  week,
  stats,
}: {
  mode: string;
  bodyFat: number | null;
  week: WeekSummary;
  stats: { label: string; value: string }[];
}) {
  const [build, setBuild] = useState<Build>('you');
  const [choice, setChoice] = useState<'auto' | Act>('auto');
  const [step, setStep] = useState(0);
  const [popKey, setPopKey] = useState(0);
  const plan = autoPlan(week.score);
  const act: Act = choice === 'auto' ? plan[step % plan.length] : choice;
  const art = build === 'you' ? artFor(mode, bodyFat) : build;
  const shownMode = build === 'you' ? mode : BUILDS.find((b) => b.value === build)!.label;

  useEffect(() => {
    if (choice !== 'auto') return;
    const id = setInterval(() => {
      if (!document.hidden) setStep((x) => x + 1);
    }, 7000);
    return () => clearInterval(id);
  }, [choice]);

  // re-trigger the pop-in whenever the pose or build changes
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPopKey((k) => k + 1);
  }, [act, art]);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className={s.stage}>
        <div className={s.hud}>
          <div className={s.eyebrow}>Body mode</div>
          <div className={s.mode}>{shownMode}</div>
          <div className={s.bars} aria-hidden="true" />
        </div>
        <div className={s.fig} data-act={act} role="img" aria-label={`Your avatar: ${LABEL[act]}`}>
          {[
            ['5%', '44%', '21%', '0s'],
            ['2%', '57%', '27%', '.15s'],
            ['7%', '71%', '18%', '.3s'],
            ['74%', '51%', '21%', '.22s'],
          ].map(([left, top, width, delay]) => (
            <div key={top} className={cn(s.fx, s.fRun, s.speed)} style={{ left, top, width, animationDelay: delay }} />
          ))}
          <div key={popKey} className={cn(s.pop, popKey && s.popping)}>
            <div className={s.move}>
              {FRAMES.map((f) => (
                <Image
                  key={f.pose}
                  src={`/avatar/${art}-${f.pose}.png`}
                  alt=""
                  fill
                  sizes="340px"
                  priority={f.pose === 'idle'}
                  className={cn(s[f.act], f.swap && s[f.swap])}
                />
              ))}
            </div>
          </div>
          <div className={cn(s.fx, s.fCurl, s.drop)} style={{ left: '59%', top: '13%' }} />
          <div className={cn(s.fx, s.fCurl, s.drop)} style={{ left: '37%', top: '15%', animationDelay: '1.1s' }} />
          <div className={cn(s.fx, s.fFlex, s.spark)} style={{ left: '10%', top: '8%' }} />
          <div className={cn(s.fx, s.fFlex, s.spark)} style={{ left: '83%', top: '6%', animationDelay: '.5s' }} />
          <div className={cn(s.fx, s.fFlex, s.spark)} style={{ left: '71%', top: '34%', width: 13, height: 13, animationDelay: '1s' }} />
          <div className={cn(s.fx, s.fThumbs, s.spark)} style={{ left: '8%', top: '34%', animationDuration: '1.4s' }} />
          <div className={cn(s.fx, s.fThumbs, s.spark)} style={{ left: '67%', top: '5%', width: 15, height: 15, animationDuration: '1.4s', animationDelay: '.7s' }} />
          {[
            ['62%', '2%', 24, '0s'],
            ['67%', '-4%', 18, '1s'],
            ['71%', '-9%', 14, '2s'],
          ].map(([left, top, size, delay]) => (
            <span key={String(top)} aria-hidden="true" className={cn(s.fx, s.fRest, s.zz)} style={{ left, top, fontSize: size as number, animationDelay: delay as string }}>
              z
            </span>
          ))}
        </div>
        <div className={s.caption} aria-live="polite">
          <span className={s.live} aria-hidden="true" />
          <b>{LABEL[act]}</b>
          <span>
            {choice === 'auto' ? 'Auto · ' : ''}
            {week.why[act]}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 px-[18px] pt-3.5 pb-[18px]">
        <div className="grid grid-cols-3 gap-2 text-center">
          {stats.map((x) => (
            <div key={x.label} className="rounded-[10px] bg-[#141413] px-1.5 py-2">
              <small className="block text-[11px] text-muted-foreground">{x.label}</small>
              <b className="font-display text-lg">{x.value}</b>
            </div>
          ))}
        </div>
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Body type</span>
        <Segmented label="Body type" size="sm" tone="teal" value={build} onChange={setBuild} options={BUILDS} />
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Animation</span>
        <Segmented label="Animation" size="sm" tone="teal" value={choice} onChange={setChoice} options={ACTS} />
      </div>
    </Card>
  );
}
