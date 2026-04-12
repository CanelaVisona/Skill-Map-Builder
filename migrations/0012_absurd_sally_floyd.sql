CREATE TABLE "book_reading_sessions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"book_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"date" varchar NOT NULL,
	"page" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books_library" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"total_pages" integer NOT NULL,
	"mode" text DEFAULT 'pages' NOT NULL,
	"goal_days" jsonb DEFAULT '[0,1,2,3,4,5]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_repetition_practices" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"emoji" text NOT NULL,
	"start_date" varchar NOT NULL,
	"completed_intervals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived" integer DEFAULT 0,
	"end_date" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "areas" ADD COLUMN "end_of_area_level" integer;--> statement-breakpoint
ALTER TABLE "global_skills" ADD COLUMN "goal_xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "global_skills" ADD COLUMN "completed" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "global_skills" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "skill_id" varchar;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "scheduled_days" jsonb DEFAULT '[0,1,2,3,4,5,6]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "end_of_area_level" integer;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "is_auto_complete" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "user_skills_progress" ADD COLUMN "area_id" varchar;--> statement-breakpoint
ALTER TABLE "book_reading_sessions" ADD CONSTRAINT "book_reading_sessions_book_id_books_library_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books_library"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_reading_sessions" ADD CONSTRAINT "book_reading_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books_library" ADD CONSTRAINT "books_library_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_repetition_practices" ADD CONSTRAINT "space_repetition_practices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_skill_id_global_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."global_skills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skills_progress" ADD CONSTRAINT "user_skills_progress_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;