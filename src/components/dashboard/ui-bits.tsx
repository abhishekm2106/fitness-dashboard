'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function Panel({
  title,
  subtitle,
  action,
  sample,
  className,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  sample?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn('min-w-0 gap-4 py-5', className)}>
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
          {sample && <SampleBadge source={sample} />}
        </CardTitle>
        {subtitle && <CardDescription className="text-xs">{subtitle}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="px-5">{children}</CardContent>
    </Card>
  );
}

/** Marks numbers that come from the sample generator rather than a connected app. */
export function SampleBadge({ source }: { source: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="cursor-help border-stage-ink/40 px-1.5 py-0 text-[10px] font-semibold tracking-wider text-stage-ink uppercase">
          Sample
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Sample data until {source} is connected</TooltipContent>
    </Tooltip>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  tone = 'light',
  size = 'default',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  tone?: 'light' | 'teal';
  size?: 'default' | 'sm';
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className="flex-wrap gap-0.5 rounded-[10px] bg-track p-[3px]"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className={cn(
            'rounded-lg font-semibold text-subtle hover:bg-white/5 hover:text-foreground',
            size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-[13px]',
            tone === 'teal' ? 'data-[state=on]:bg-teal data-[state=on]:text-teal-ink' : 'data-[state=on]:bg-foreground data-[state=on]:text-background',
          )}
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const n = values.length;
  const lo = Math.min(...values);
  const hi = Math.max(...values) === lo ? lo + 1 : Math.max(...values);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${n === 1 ? 50 : ((i / (n - 1)) * 100).toFixed(2)} ${(96 - ((v - lo) / (hi - lo)) * 92).toFixed(2)}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="mt-1 h-[34px] w-full overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Swatch({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block size-2 shrink-0 rounded-[2px]', className)} style={{ background: color }} />;
}

export const toneClass = { good: 'text-good', bad: 'text-bad', flat: 'text-muted-foreground' } as const;
