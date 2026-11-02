// Turns a Health Auto Export JSON delivery into one value per day and metric.
// Format: { data: { metrics: [{ name, units, data: [{ date: "yyyy-MM-dd HH:mm:ss Z", qty, source }] }] } }
// Only step_count, dietary_energy and the sleep fields are confirmed in its docs, so each metric
// accepts the likely name variants, and anything unrecognised is kept and reported back.

export type Metric = 'steps' | 'weight_kg' | 'body_fat_pct' | 'sleep_h' | 'hrv_ms' | 'resting_hr' | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'active_kcal';

type Agg = 'sum' | 'avg' | 'last';

const METRICS: Record<Exclude<Metric, 'sleep_h'>, { names: string[]; agg: Agg; min: number; max: number; convert?: (v: number, units: string) => number }> = {
  steps: { names: ['step_count'], agg: 'sum', min: 0, max: 200_000 },
  weight_kg: { names: ['weight_body_mass', 'body_mass', 'weight'], agg: 'last', min: 20, max: 400, convert: (v, u) => (/lb/i.test(u) ? v * 0.453592 : v) },
  // some exports give a fraction (0.15), others a percentage (15)
  body_fat_pct: { names: ['body_fat_percentage', 'body_fat'], agg: 'last', min: 2, max: 70, convert: (v) => (v <= 1 ? v * 100 : v) },
  hrv_ms: { names: ['heart_rate_variability', 'heart_rate_variability_sdnn'], agg: 'avg', min: 1, max: 400 },
  resting_hr: { names: ['resting_heart_rate'], agg: 'avg', min: 20, max: 200 },
  kcal: { names: ['dietary_energy', 'dietary_energy_consumed'], agg: 'sum', min: 0, max: 20_000, convert: (v, u) => (/kj/i.test(u) ? v / 4.184 : v) },
  protein_g: { names: ['protein', 'dietary_protein'], agg: 'sum', min: 0, max: 2_000 },
  carbs_g: { names: ['carbohydrates', 'dietary_carbohydrates'], agg: 'sum', min: 0, max: 2_000 },
  fat_g: { names: ['total_fat', 'dietary_fat_total', 'fat_total'], agg: 'sum', min: 0, max: 2_000 },
  active_kcal: { names: ['active_energy', 'active_energy_burned'], agg: 'sum', min: 0, max: 20_000, convert: (v, u) => (/kj/i.test(u) ? v / 4.184 : v) },
};

const BY_NAME = new Map<string, Exclude<Metric, 'sleep_h'>>(Object.entries(METRICS).flatMap(([m, d]) => d.names.map((n) => [n, m as Exclude<Metric, 'sleep_h'>])));
const SLEEP_NAMES = new Set(['sleep_analysis']);
const ASLEEP = new Set(['asleep', 'core', 'rem', 'deep', 'unspecified']);

export interface ParsedValue {
  date: string;
  metric: Metric;
  value: number;
}

export interface ParseSummary {
  points: number;
  days: number;
  from: string | null;
  to: string | null;
  metrics: Partial<Record<Metric, number>>;
  unknown: string[];
}

/** "2024-02-06 14:30:00 -0800" → "2024-02-06", the phone's local calendar day */
const day = (s: unknown): string | null => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

export class ParseError extends Error {}

export function parseExport(body: unknown): { values: ParsedValue[]; summary: ParseSummary } {
  const metrics = (body as { data?: { metrics?: unknown } })?.data?.metrics;
  if (!Array.isArray(metrics)) throw new ParseError('Expected Health Metrics JSON: { "data": { "metrics": [...] } }.');

  // collect samples per day and metric, then aggregate
  const buckets = new Map<string, { metric: Metric; date: string; agg: Agg | 'sleep'; values: number[] }>();
  const add = (metric: Metric, date: string, agg: Agg | 'sleep', v: number) => {
    const key = `${date}|${metric}`;
    const b = buckets.get(key) ?? { metric, date, agg, values: [] };
    b.values.push(v);
    buckets.set(key, b);
  };
  const unknown = new Set<string>();
  let points = 0;

  for (const m of metrics as { name?: unknown; units?: unknown; data?: unknown }[]) {
    const name = typeof m?.name === 'string' ? m.name.toLowerCase() : '';
    const units = typeof m?.units === 'string' ? m.units : '';
    if (!Array.isArray(m?.data)) continue;

    if (SLEEP_NAMES.has(name)) {
      for (const p of m.data as Record<string, unknown>[]) {
        points++;
        // Summarize Data on: one entry per night with totals; the night counts toward the day you woke up
        const total = num(p.totalSleep) ?? num(p.asleep) ?? ([p.core, p.deep, p.rem].some((x) => num(x) != null) ? (num(p.core) ?? 0) + (num(p.deep) ?? 0) + (num(p.rem) ?? 0) : null);
        if (total != null) {
          const d = day(p.sleepEnd) ?? day(p.date);
          if (d && total > 0 && total <= 24) add('sleep_h', d, 'sleep', total);
          continue;
        }
        // Summarize Data off: one segment per stage; add up the asleep ones
        const stage = typeof p.value === 'string' ? p.value.toLowerCase() : '';
        const d = day(p.endDate) ?? day(p.end) ?? day(p.date);
        const qty = num(p.qty);
        if (d && qty != null && ASLEEP.has(stage)) add('sleep_h', d, 'sleep', qty);
      }
      continue;
    }

    const metric = BY_NAME.get(name);
    if (!metric) {
      if (name) unknown.add(name);
      continue;
    }
    const def = METRICS[metric];
    for (const p of m.data as Record<string, unknown>[]) {
      points++;
      const d = day(p.date);
      const raw = num(p.qty);
      if (!d || raw == null) continue;
      const v = def.convert ? def.convert(raw, units) : raw;
      if (v >= def.min && v <= def.max) add(metric, d, def.agg, v);
    }
  }

  const values: ParsedValue[] = [];
  const counts: Partial<Record<Metric, number>> = {};
  for (const b of buckets.values()) {
    const sum = b.values.reduce((s, x) => s + x, 0);
    let value = b.agg === 'avg' ? sum / b.values.length : b.agg === 'last' ? b.values[b.values.length - 1] : sum;
    if (b.agg === 'sleep') value = Math.min(value, 24);
    values.push({ date: b.date, metric: b.metric, value: Math.round(value * 100) / 100 });
    counts[b.metric] = (counts[b.metric] ?? 0) + 1;
  }
  const dates = [...new Set(values.map((v) => v.date))].sort();
  return {
    values,
    summary: { points, days: dates.length, from: dates[0] ?? null, to: dates.at(-1) ?? null, metrics: counts, unknown: [...unknown].sort() },
  };
}
