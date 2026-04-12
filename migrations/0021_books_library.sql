CREATE TABLE "books_library" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL DEFAULT '',
	"total_pages" integer NOT NULL,
	"mode" text NOT NULL DEFAULT 'pages',
	"goal_days" jsonb NOT NULL DEFAULT '[0,1,2,3,4,5]'::jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	CONSTRAINT "books_library_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade
);

CREATE TABLE "book_reading_sessions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"book_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"date" varchar NOT NULL,
	"page" integer NOT NULL,
	"created_at" timestamp NOT NULL DEFAULT now(),
	CONSTRAINT "book_reading_sessions_book_id_books_library_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books_library"("id") ON DELETE cascade,
	CONSTRAINT "book_reading_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade
);
