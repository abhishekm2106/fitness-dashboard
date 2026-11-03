CREATE TABLE "body_measurements" (
	"date" date PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'hevy' NOT NULL,
	"weight_kg" real,
	"lean_mass_kg" real,
	"fat_percent" real,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "exercise_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"primary_muscle_group" text,
	"secondary_muscle_groups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"equipment" text,
	"is_custom" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"id" serial PRIMARY KEY NOT NULL,
	"workout_id" text NOT NULL,
	"index" integer NOT NULL,
	"title" text NOT NULL,
	"exercise_template_id" text NOT NULL,
	"notes" text,
	"superset_id" integer
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"exercise_id" integer NOT NULL,
	"index" integer NOT NULL,
	"type" text NOT NULL,
	"weight_kg" real,
	"reps" integer,
	"distance_meters" real,
	"duration_seconds" integer,
	"rpe" real,
	"e1rm_kg" real
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'hevy' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"routine_id" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"volume_kg" real DEFAULT 0 NOT NULL,
	"duration_min" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_exercise_id_workout_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."workout_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workout_exercises_workout_idx" ON "workout_exercises" USING btree ("workout_id");--> statement-breakpoint
CREATE INDEX "workout_exercises_template_idx" ON "workout_exercises" USING btree ("exercise_template_id");--> statement-breakpoint
CREATE INDEX "workout_sets_exercise_idx" ON "workout_sets" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "workouts_start_idx" ON "workouts" USING btree ("start_time");