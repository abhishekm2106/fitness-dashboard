// Shared by the server and the Settings card and setup guide, so nothing here touches the database
import type { Metric, ParseSummary } from './parse';

export interface AppleHealthStatus {
  connectedAt: string;
  lastReceivedAt: string | null;
  summary: (ParseSummary & { at?: string }) | null;
  lastError: string | null;
  secretHint: string | null;
}

/** What to tick in Health Auto Export, and what each one powers on the dashboard */
export const METRIC_GUIDE: { metric: Metric; label: string; app: string; powers: string }[] = [
  { metric: 'sleep_h', label: 'Sleep', app: 'Sleep Analysis', powers: 'Recovery chart, sleep KPI, effort score' },
  { metric: 'hrv_ms', label: 'HRV', app: 'Heart Rate Variability', powers: 'Recovery chart, HRV KPI' },
  { metric: 'resting_hr', label: 'Resting HR', app: 'Resting Heart Rate', powers: 'Stored for upcoming recovery insights' },
  { metric: 'steps', label: 'Steps', app: 'Step Count', powers: 'Steps KPI' },
  { metric: 'active_kcal', label: 'Active energy', app: 'Active Energy', powers: 'Stored for upcoming energy balance' },
  { metric: 'weight_kg', label: 'Weight', app: 'Weight & Body Mass', powers: 'Body weight card, avatar stats' },
  { metric: 'body_fat_pct', label: 'Body fat', app: 'Body Fat Percentage', powers: 'Body weight card, avatar body type' },
  { metric: 'kcal', label: 'Calories', app: 'Dietary Energy', powers: 'Nutrition card' },
  { metric: 'protein_g', label: 'Protein', app: 'Protein', powers: 'Nutrition card, effort score' },
  { metric: 'carbs_g', label: 'Carbs', app: 'Carbohydrates', powers: 'Nutrition card' },
  { metric: 'fat_g', label: 'Fat', app: 'Total Fat', powers: 'Nutrition card' },
];

export const HAE_APP_STORE = 'https://apps.apple.com/app/id1115567069';

// As the App Store lists it, so it can't be mistaken for Apple's own Health app
export const HAE_APP = { name: 'Health Auto Export - JSON+CSV', developer: 'Lybron Sobers', subtitle: 'Export Health & Workout data' };
