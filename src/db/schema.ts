import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const exerciseTemplates = pgTable('exercise_templates', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  primaryMuscleGroup: text('primary_muscle_group'),
  secondaryMuscleGroups: jsonb('secondary_muscle_groups').$type<string[]>().notNull().default([]),
  equipment: text('equipment'),
  isCustom: boolean('is_custom').notNull().default(false),
});

export const workouts = pgTable(
  'workouts',
  {
    id: text('id').primaryKey(),
    source: text('source').notNull().default('hevy'),
    title: text('title').notNull(),
    description: text('description'),
    routineId: text('routine_id'),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    // derived on write so the dashboard never has to re-add every set
    volumeKg: real('volume_kg').notNull().default(0),
    durationMin: integer('duration_min').notNull().default(0),
  },
  (t) => [index('workouts_start_idx').on(t.startTime)],
);

export const workoutExercises = pgTable(
  'workout_exercises',
  {
    id: serial('id').primaryKey(),
    workoutId: text('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    index: integer('index').notNull(),
    title: text('title').notNull(),
    exerciseTemplateId: text('exercise_template_id').notNull(),
    notes: text('notes'),
    supersetId: integer('superset_id'),
  },
  (t) => [index('workout_exercises_workout_idx').on(t.workoutId), index('workout_exercises_template_idx').on(t.exerciseTemplateId)],
);

export const workoutSets = pgTable(
  'workout_sets',
  {
    id: serial('id').primaryKey(),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => workoutExercises.id, { onDelete: 'cascade' }),
    index: integer('index').notNull(),
    type: text('type').notNull(),
    weightKg: real('weight_kg'),
    reps: integer('reps'),
    distanceMeters: real('distance_meters'),
    durationSeconds: integer('duration_seconds'),
    rpe: real('rpe'),
    // Epley estimate, only for working sets of 1-12 reps
    e1rmKg: real('e1rm_kg'),
  },
  (t) => [index('workout_sets_exercise_idx').on(t.exerciseId)],
);

export const bodyMeasurements = pgTable('body_measurements', {
  date: date('date').primaryKey(),
  source: text('source').notNull().default('hevy'),
  weightKg: real('weight_kg'),
  leanMassKg: real('lean_mass_kg'),
  fatPercent: real('fat_percent'),
  raw: jsonb('raw').$type<Record<string, number | string | null>>(),
});

// key/value bookkeeping for incremental syncs (e.g. "hevy.workouts.since")
export const syncState = pgTable('sync_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Sign-in (Auth.js). Sessions are JWT cookies, so there is no sessions table. ---

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true, mode: 'date' }),
  image: text('image'),
});

// one row per linked Google or Apple login
export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: text('token_type'),
    scope: text('scope'),
    idToken: text('id_token'),
    sessionState: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] }), index('accounts_user_idx').on(t.userId)],
);

// pending email sign-in codes; only a hash of the code is stored
export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
    // wrong guesses against this email's code; the code is dropped at the limit
    attempts: integer('attempts').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const workoutsRelations = relations(workouts, ({ many }) => ({ exercises: many(workoutExercises) }));
export const workoutExercisesRelations = relations(workoutExercises, ({ one, many }) => ({
  workout: one(workouts, { fields: [workoutExercises.workoutId], references: [workouts.id] }),
  sets: many(workoutSets),
}));
export const workoutSetsRelations = relations(workoutSets, ({ one }) => ({
  exercise: one(workoutExercises, { fields: [workoutSets.exerciseId], references: [workoutExercises.id] }),
}));
