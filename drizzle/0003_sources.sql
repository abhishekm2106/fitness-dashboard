CREATE TABLE "health_metrics" (
	"date" date NOT NULL,
	"metric" text NOT NULL,
	"value" real NOT NULL,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "health_metrics_date_metric_pk" PRIMARY KEY("date","metric")
);
--> statement-breakpoint
CREATE TABLE "source_connections" (
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"secret_hash" text,
	"secret_hint" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_received_at" timestamp with time zone,
	"last_summary" jsonb,
	"last_error" text,
	CONSTRAINT "source_connections_user_id_source_pk" PRIMARY KEY("user_id","source")
);
--> statement-breakpoint
ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_connections_secret_idx" ON "source_connections" USING btree ("secret_hash");