// Every app the dashboard pulls from (or will), with what each one contributes

export type SourceId = 'hevy' | 'lyfta' | 'strava' | 'oura' | 'apple-health' | 'nutrition';

export interface SourceInfo {
  id: SourceId;
  name: string;
  /** what the dashboard gets from it */
  provides: string[];
  /** how it connects, or will */
  via: string;
  /** the dashboard cards it powers, written to follow "feeds" or "sample data for" */
  feeds: string;
  /** replaces the "sample data until connected" line, for sources that add history rather than replace sample data */
  note?: string;
}

export const SOURCES: SourceInfo[] = [
  { id: 'hevy', name: 'Hevy', provides: ['Workouts', 'Sets & PRs', 'Body measurements'], via: 'Hevy API · syncs daily', feeds: 'strength, PRs, consistency and body weight' },
  { id: 'strava', name: 'Strava', provides: ['Runs', 'Rides', 'Pace'], via: 'Strava API', feeds: 'running distance and cardio time' },
  { id: 'oura', name: 'Oura', provides: ['Sleep', 'HRV', 'Readiness'], via: 'Oura API', feeds: 'recovery and sleep' },
  { id: 'apple-health', name: 'Apple Health', provides: ['Sleep', 'HRV', 'Steps', 'Weight', 'Nutrition'], via: 'Health export, Shortcuts or Health Auto Export', feeds: 'recovery, steps, weigh-ins and nutrition' },
  { id: 'nutrition', name: 'Nutrition app', provides: ['Calories', 'Macros'], via: 'MyFitnessPal or Cronometer export', feeds: 'nutrition' },
  { id: 'lyfta', name: 'Lyfta', provides: ['Workouts'], via: 'CSV import', feeds: 'strength history from before Hevy', note: 'Imports your older Lyfta workouts so strength charts and PRs reach back further.' },
];
