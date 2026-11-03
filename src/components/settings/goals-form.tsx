'use client';

import { Loader2Icon, RotateCcwIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { resetGoals, saveGoals } from '@/app/settings/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_SETTINGS, GOAL_FIELDS, type Goals } from '@/lib/settings';

const GROUPS: { title: string; keys: (keyof Goals)[] }[] = [
  { title: 'Training', keys: ['weeklySessions', 'weeklyMinutes'] },
  { title: 'Recovery', keys: ['sleepHours'] },
  { title: 'Nutrition', keys: ['calories', 'protein', 'carbs', 'fat'] },
];

const same = (a: Goals, b: Goals) => GOAL_FIELDS.every((f) => a[f.key] === b[f.key]);

export function GoalsForm({ initial }: { initial: Goals }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState<Record<keyof Goals, string>>(() => strings(initial));
  const [pending, start] = useTransition();

  const values = Object.fromEntries(GOAL_FIELDS.map((f) => [f.key, Number(draft[f.key])])) as unknown as Goals;
  const invalid = GOAL_FIELDS.filter((f) => draft[f.key] === '' || !(values[f.key] >= f.min && values[f.key] <= f.max)).map((f) => f.key);
  const dirty = !same(values, saved);

  function run(action: () => ReturnType<typeof saveGoals>, message: string) {
    start(async () => {
      const res = await action();
      if (!res.ok) return void toast.error(res.error);
      if (res.settings) {
        setSaved(res.settings.goals);
        setDraft(strings(res.settings.goals));
      }
      toast.success(message);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid.length) run(() => saveGoals(values), 'Goals saved. The dashboard uses them now.');
      }}
      className="flex flex-col gap-6"
    >
      {GROUPS.map((g) => (
        <fieldset key={g.title} className="flex flex-col gap-3">
          <legend className="mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{g.title}</legend>
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {g.keys.map((key) => {
              const f = GOAL_FIELDS.find((x) => x.key === key)!;
              const bad = invalid.includes(key);
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`goal-${key}`} className="text-sm">
                    {f.label}
                  </Label>
                  <div className="relative">
                    <Input
                      id={`goal-${key}`}
                      type="number"
                      inputMode="decimal"
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={draft[key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      aria-invalid={bad || undefined}
                      aria-describedby={`goal-${key}-hint`}
                      className="h-11 rounded-[10px] pr-20 text-[15px] tabular-nums"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{f.unit}</span>
                  </div>
                  <p id={`goal-${key}-hint`} className={bad ? 'text-xs text-bad' : 'text-xs text-muted-foreground'}>
                    {bad ? `Enter a number from ${f.min} to ${f.max}.` : f.hint}
                  </p>
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-grid pt-5">
        <Button
          type="button"
          variant="ghost"
          disabled={pending || same(saved, DEFAULT_SETTINGS.goals)}
          onClick={() => run(resetGoals, 'Goals reset to the defaults.')}
          className="text-subtle"
        >
          <RotateCcwIcon aria-hidden />
          Reset to defaults
        </Button>
        <div className="flex items-center gap-3">
          {dirty && !pending && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          <Button type="submit" disabled={!dirty || invalid.length > 0 || pending} className="h-10 rounded-[10px] px-5 font-semibold">
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            {pending ? 'Saving…' : 'Save goals'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function strings(g: Goals) {
  return Object.fromEntries(GOAL_FIELDS.map((f) => [f.key, String(g[f.key])])) as Record<keyof Goals, string>;
}
