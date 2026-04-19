CREATE TABLE "archived_rewiring_trackers" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"total_actions" integer NOT NULL,
	"start_date" timestamp,
	"completed_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewiring_tracker_history" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tracker_id" varchar NOT NULL,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewiring_trackers" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"area_id" varchar,
	"project_id" varchar,
	"skill_id" varchar,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "books_library" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "archived_rewiring_trackers" ADD CONSTRAINT "archived_rewiring_trackers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewiring_tracker_history" ADD CONSTRAINT "rewiring_tracker_history_tracker_id_rewiring_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."rewiring_trackers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewiring_trackers" ADD CONSTRAINT "rewiring_trackers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;