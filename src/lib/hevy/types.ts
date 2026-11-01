// Shapes from Hevy's public API (https://api.hevyapp.com/docs), v0.0.1.

export type HevySetType = 'warmup' | 'normal' | 'failure' | 'dropset' | string;

export interface HevySet {
  index: number;
  type: HevySetType;
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe: number | null;
  custom_metric: number | null;
}

export interface HevyExercise {
  index: number;
  title: string;
  notes: string | null;
  exercise_template_id: string;
  superset_id: number | null;
  sets: HevySet[];
}

export interface HevyWorkout {
  id: string;
  title: string;
  routine_id: string | null;
  description: string | null;
  start_time: string;
  end_time: string;
  updated_at: string;
  created_at: string;
  exercises: HevyExercise[];
}

export type HevyWorkoutEvent =
  | { type: 'updated'; workout: HevyWorkout }
  | { type: 'deleted'; id: string; deleted_at: string };

export interface HevyExerciseTemplate {
  id: string;
  title: string;
  type: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  equipment: string;
  is_custom: boolean;
  thumbnail_url?: string | null;
}

export interface HevyBodyMeasurement {
  date: string;
  weight_kg: number | null;
  lean_mass_kg: number | null;
  fat_percent: number | null;
  [key: string]: number | string | null;
}

export interface HevyUserInfo {
  id: string;
  username: string;
  name: string;
  url: string;
  weight_unit: string;
  distance_unit: string;
  is_pro: boolean;
}

export interface Paged {
  page: number;
  page_count: number;
}
