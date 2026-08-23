CREATE TABLE IF NOT EXISTS "node_errors" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"skill_id" varchar NOT NULL,
	"nombre" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"confirmed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "node_error_records" (
	"id" varchar PRIMARY KEY NOT NULL,
	"error_id" varchar NOT NULL,
	"user_id" varchar,
	"delta" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "node_errors" ADD CONSTRAINT "node_errors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "node_error_records" ADD CONSTRAINT "node_error_records_error_id_node_errors_id_fk" FOREIGN KEY ("error_id") REFERENCES "node_errors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "node_error_records" ADD CONSTRAINT "node_error_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
