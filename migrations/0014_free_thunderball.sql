CREATE TABLE "rewiring_tracker_records" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tracker_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "archived_rewiring_trackers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rewiring_tracker_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "archived_rewiring_trackers" CASCADE;--> statement-breakpoint
DROP TABLE "rewiring_tracker_history" CASCADE;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "freeze_dates" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "rewiring_trackers" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "rewiring_tracker_records" ADD CONSTRAINT "rewiring_tracker_records_tracker_id_rewiring_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."rewiring_trackers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewiring_tracker_records" ADD CONSTRAINT "rewiring_tracker_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewiring_trackers" ADD CONSTRAINT "rewiring_trackers_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewiring_trackers" ADD CONSTRAINT "rewiring_trackers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewiring_trackers" ADD CONSTRAINT "rewiring_trackers_skill_id_global_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."global_skills"("id") ON DELETE set null ON UPDATE no action;