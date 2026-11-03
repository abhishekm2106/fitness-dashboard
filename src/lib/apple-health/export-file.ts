// Reads Apple Health's own "Export All Health Data" file (export.xml inside export.zip) into one value
// per day and metric. It runs in the browser, so the raw file never leaves the computer.
//
// Each sample is a line like:
//   <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count"
//           startDate="2024-01-05 07:30:00 +0530" endDate="..." value="120"/>
// iPhone and Apple Watch both record steps and energy, so per-day totals are taken from the
// source with the largest total rather than added together, which would count them twice.

import { inRange, type Metric, type ParsedValue, type ParseSummary } from './parse';

type Rule = { metric: Metric; agg: 'sum' | 'avg' | 'last'; convert?: (v: number, unit: string) => number };

const kcal = (v: number, unit: string) => (/kj/i.test(unit) ? v / 4.184 : v);

const RULES: Record<string, Rule> = {
  HKQuantityTypeIdentifierStepCount: { metric: 'steps', agg: 'sum' },
  HKQuantityTypeIdentifierActiveEnergyBurned: { metric: 'active_kcal', agg: 'sum', convert: kcal },
  HKQuantityTypeIdentifierDietaryEnergyConsumed: { metric: 'kcal', agg: 'sum', convert: kcal },
  HKQuantityTypeIdentifierDietaryProtein: { metric: 'protein_g', agg: 'sum' },
  HKQuantityTypeIdentifierDietaryCarbohydrates: { metric: 'carbs_g', agg: 'sum' },
  HKQuantityTypeIdentifierDietaryFatTotal: { metric: 'fat_g', agg: 'sum' },
  HKQuantityTypeIdentifierBodyMass: { metric: 'weight_kg', agg: 'last', convert: (v, u) => (/lb/i.test(u) ? v * 0.453592 : /st/i.test(u) ? v * 6.35029 : v) },
  HKQuantityTypeIdentifierBodyFatPercentage: { metric: 'body_fat_pct', agg: 'last', convert: (v) => (v <= 1 ? v * 100 : v) },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: { metric: 'hrv_ms', agg: 'avg' },
  HKQuantityTypeIdentifierRestingHeartRate: { metric: 'resting_hr', agg: 'avg' },
};
const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';
// InBed and Awake don't count as sleep
const ASLEEP = /HKCategoryValueSleepAnalysisAsleep/;

const ATTR = /(\w+)="([^"]*)"/g;

/** "2024-01-05 07:30:00 +0530" → epoch ms */
const toTime = (s: string) => Date.parse(s.replace(' ', 'T').replace(/ ([+-]\d\d)(\d\d)$/, '$1:$2'));

type Cell = { sum: number; n: number; last: number; lastAt: number };

export class HealthExportReader {
  private rest = '';
  private cells = new Map<string, Cell>(); // metric|date|source
  private records = 0;

  /** Feed decoded text in any chunk size */
  push(text: string) {
    const lines = (this.rest + text).split('\n');
    this.rest = lines.pop() ?? '';
    for (const line of lines) this.line(line);
  }

  private line(line: string) {
    const i = line.indexOf('<Record ');
    if (i < 0) return;
    const typeAt = line.indexOf('type="', i);
    if (typeAt < 0) return;
    const type = line.slice(typeAt + 6, line.indexOf('"', typeAt + 6));
    const rule = RULES[type];
    if (!rule && type !== SLEEP) return;

    const a: Record<string, string> = {};
    for (const m of line.slice(i).matchAll(ATTR)) a[m[1]] = m[2];
    this.records++;
    const source = a.sourceName ?? '';

    if (type === SLEEP) {
      if (!ASLEEP.test(a.value ?? '') || !a.startDate || !a.endDate) return;
      const hours = (toTime(a.endDate) - toTime(a.startDate)) / 3_600_000;
      // the night belongs to the morning you woke up
      if (hours > 0 && hours < 24) this.add('sleep_h', a.endDate.slice(0, 10), source, hours, 'sum', 0);
      return;
    }

    const raw = Number(a.value);
    if (!Number.isFinite(raw) || !a.startDate) return;
    const v = rule.convert ? rule.convert(raw, a.unit ?? '') : raw;
    this.add(rule.metric, a.startDate.slice(0, 10), source, v, rule.agg, toTime(a.startDate));
  }

  private add(metric: Metric, date: string, source: string, v: number, agg: Rule['agg'], at: number) {
    // averages and latest values combine all sources; totals are kept per source
    const key = `${metric}|${date}|${agg === 'sum' ? source : ''}`;
    const c = this.cells.get(key) ?? { sum: 0, n: 0, last: v, lastAt: -Infinity };
    c.sum += v;
    c.n++;
    if (at >= c.lastAt) {
      c.last = v;
      c.lastAt = at;
    }
    this.cells.set(key, c);
  }

  finish(): { values: ParsedValue[]; summary: ParseSummary } {
    if (this.rest) this.line(this.rest);
    const ruleFor = (m: Metric) => (m === 'sleep_h' ? 'sum' : Object.values(RULES).find((r) => r.metric === m)!.agg);
    const best = new Map<string, ParsedValue>();
    for (const [key, c] of this.cells) {
      const [metric, date] = key.split('|') as [Metric, string];
      const kind = ruleFor(metric);
      const value = kind === 'sum' ? c.sum : kind === 'avg' ? c.sum / c.n : c.last;
      const k = `${metric}|${date}`;
      // totals: the source that recorded the most wins
      if (!best.has(k) || value > best.get(k)!.value) best.set(k, { date, metric, value: Math.round(value * 100) / 100 });
    }
    const values = [...best.values()].filter((v) => inRange(v.metric, v.value));
    const counts: Partial<Record<Metric, number>> = {};
    for (const v of values) counts[v.metric] = (counts[v.metric] ?? 0) + 1;
    const dates = [...new Set(values.map((v) => v.date))].sort();
    return {
      values,
      summary: { points: this.records, days: dates.length, from: dates[0] ?? null, to: dates.at(-1) ?? null, metrics: counts, unknown: [], via: 'export-file' },
    };
  }
}
