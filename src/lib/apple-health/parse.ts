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
  /** how it arrived: Health Auto Export, a Shortcut, or an uploaded Health export */
  via?: Via;
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

// --- Shortcuts: one flat object per day ---------------------------------------------------------
// { "date": "2026-11-01", "steps": 9332, "sleep": 25560, "hrv": 52, "weight": 77.2, "weight_unit": "kg", ... }
// or { "days": [ ...those objects ] }. Values may arrive as text ("9,332", "7,1"), and an empty or 0
// value means "not tracked". Sleep is last night's, so it counts toward the day after "date".

const RANGE: Record<Metric, [number, number]> = {
  steps: [1, 200_000],
  weight_kg: [20, 400],
  body_fat_pct: [2, 70],
  sleep_h: [0.25, 24],
  hrv_ms: [1, 400],
  resting_hr: [20, 200],
  kcal: [1, 20_000],
  protein_g: [1, 2_000],
  carbs_g: [1, 2_000],
  fat_g: [1, 2_000],
  active_kcal: [1, 20_000],
};

/** True when a value is plausible for its metric; used for every source */
export const inRange = (metric: Metric, v: number) => Number.isFinite(v) && v >= RANGE[metric][0] && v <= RANGE[metric][1];

/** Reads numbers that Shortcuts may send as text, with thousands separators or a decimal comma */
export function looseNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.replace(/[\s  ]/g, '').replace(/[^\d.,-]+$/, '');
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  const n = Number(s);
  return s !== '' && Number.isFinite(n) ? n : null;
}

const DAILY: Record<string, Exclude<Metric, 'sleep_h'>> = {
  steps: 'steps',
  step_count: 'steps',
  hrv: 'hrv_ms',
  hrv_ms: 'hrv_ms',
  heart_rate_variability: 'hrv_ms',
  resting_hr: 'resting_hr',
  resting_heart_rate: 'resting_hr',
  active_energy: 'active_kcal',
  active_kcal: 'active_kcal',
  weight: 'weight_kg',
  weight_kg: 'weight_kg',
  weight_lb: 'weight_kg',
  body_fat: 'body_fat_pct',
  body_fat_pct: 'body_fat_pct',
  calories: 'kcal',
  kcal: 'kcal',
  dietary_energy: 'kcal',
  protein: 'protein_g',
  protein_g: 'protein_g',
  carbs: 'carbs_g',
  carbs_g: 'carbs_g',
  carbohydrates: 'carbs_g',
  fat: 'fat_g',
  fat_g: 'fat_g',
  total_fat: 'fat_g',
};
const IGNORED = new Set(['date', 'sleep_date', 'weight_unit', 'energy_unit', 'format', 'source']);
const SLEEP_KEYS = new Set(['sleep', 'sleep_h', 'sleep_min', 'sleep_s']);

const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** Sleep sent as a plain number: hours if it fits in a day, then minutes, then seconds */
function sleepHours(key: string, v: number): number {
  if (key === 'sleep_h') return v;
  if (key === 'sleep_min') return v / 60;
  if (key === 'sleep_s') return v / 3600;
  return v <= 24 ? v : v <= 1440 ? v / 60 : v / 3600;
}

export function parseDaily(body: unknown): { values: ParsedValue[]; summary: ParseSummary } {
  const b = body as { days?: unknown };
  const days = Array.isArray(b?.days) ? b.days : b && typeof b === 'object' && 'date' in b ? [b] : null;
  if (!days) throw new ParseError('Expected a day object with a "date", like { "date": "2026-11-01", "steps": 9000 }, or { "days": [...] }.');

  const out = new Map<string, ParsedValue>();
  const unknown = new Set<string>();
  let points = 0;
  for (const raw of days as Record<string, unknown>[]) {
    const date = day(raw?.date);
    if (!date) throw new ParseError(`Each day needs a "date" formatted yyyy-MM-dd; got ${JSON.stringify(raw?.date ?? null)}.`);
    const weightLb = /lb|pound/i.test(String(raw.weight_unit ?? ''));
    const energyKj = /kj|joule/i.test(String(raw.energy_unit ?? ''));
    for (const [key, rawValue] of Object.entries(raw)) {
      const k = key.toLowerCase();
      if (IGNORED.has(k)) continue;
      const v = looseNum(rawValue);
      if (SLEEP_KEYS.has(k)) {
        points++;
        if (v == null || v <= 0) continue;
        const h = Math.round(sleepHours(k, v) * 100) / 100;
        const d = day(raw.sleep_date) ?? nextDay(date);
        if (inRange('sleep_h', h)) out.set(`${d}|sleep_h`, { date: d, metric: 'sleep_h', value: h });
        continue;
      }
      const metric = DAILY[k];
      if (!metric) {
        unknown.add(key);
        continue;
      }
      points++;
      if (v == null || v === 0) continue;
      let value = v;
      if (metric === 'weight_kg' && (k === 'weight_lb' || (k === 'weight' && weightLb))) value = v * 0.453592;
      if (metric === 'body_fat_pct' && v <= 1) value = v * 100;
      if ((metric === 'kcal' || metric === 'active_kcal') && energyKj) value = v / 4.184;
      value = Math.round(value * 100) / 100;
      if (inRange(metric, value)) out.set(`${date}|${metric}`, { date, metric, value });
    }
  }
  const values = [...out.values()];
  const counts: Partial<Record<Metric, number>> = {};
  for (const v of values) counts[v.metric] = (counts[v.metric] ?? 0) + 1;
  const dates = [...new Set(values.map((v) => v.date))].sort();
  return { values, summary: { points, days: dates.length, from: dates[0] ?? null, to: dates.at(-1) ?? null, metrics: counts, unknown: [...unknown].sort() } };
}

export type Via = 'auto-export' | 'shortcut' | 'export-file';

/** Health Auto Export sends { data: { metrics } }; a Shortcut sends flat day objects */
export function parseDelivery(body: unknown): { values: ParsedValue[]; summary: ParseSummary; via: Via } {
  if ((body as { data?: unknown })?.data) return { ...parseExport(body), via: 'auto-export' };
  return { ...parseDaily(body), via: 'shortcut' };
}
