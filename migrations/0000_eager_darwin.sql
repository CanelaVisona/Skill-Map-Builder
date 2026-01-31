CREATE TABLE "areas" (
	"user_id" varchar,
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"description" text NOT NULL,
	"unlocked_level" integer DEFAULT 1 NOT NULL,
	"next_level_to_assign" integer DEFAULT 1 NOT NULL,
	"level_subtitles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "journal_characters" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"action" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "journal_learnings" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"title" text NOT NULL,
	"sentence" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_places" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"action" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "journal_shadows" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"action" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_url" text,
	"defeated" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "journal_tools" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"title" text NOT NULL,
	"sentence" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_about_entries" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_likes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_missions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_values" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"user_id" varchar,
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"description" text NOT NULL,
	"unlocked_level" integer DEFAULT 1 NOT NULL,
	"next_level_to_assign" integer DEFAULT 1 NOT NULL,
	"level_subtitles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived" integer DEFAULT 0,
	"quest_type" text DEFAULT 'main'
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" varchar PRIMARY KEY NOT NULL,
	"area_id" varchar,
	"project_id" varchar,
	"parent_skill_id" varchar,
	"title" text NOT NULL,
	"action" text DEFAULT '' NOT NULL,
	"description" text NOT NULL,
	"feedback" text DEFAULT '',
	"status" text NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"dependencies" jsonb NOT NULL,
	"manual_lock" integer DEFAULT 0,
	"is_final_node" integer DEFAULT 0,
	"level" integer DEFAULT 1 NOT NULL,
	"level_position" integer DEFAULT 1 NOT NULL,
	"experience_points" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"profile_mission" text DEFAULT '',
	"profile_values" text DEFAULT '',
	"profile_likes" text DEFAULT '',
	"profile_about" text DEFAULT '',
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_characters" ADD CONSTRAINT "journal_characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_learnings" ADD CONSTRAINT "journal_learnings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_places" ADD CONSTRAINT "journal_places_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_shadows" ADD CONSTRAINT "journal_shadows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_tools" ADD CONSTRAINT "journal_tools_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_about_entries" ADD CONSTRAINT "profile_about_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_likes" ADD CONSTRAINT "profile_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_missions" ADD CONSTRAINT "profile_missions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_values" ADD CONSTRAINT "profile_values_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;