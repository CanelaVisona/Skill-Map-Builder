CREATE TABLE IF NOT EXISTS "book_wishlist" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL DEFAULT '',
	"status" text NOT NULL DEFAULT 'no_leido',
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	CONSTRAINT "book_wishlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "book_wishlist_user_id_idx" ON "book_wishlist"("user_id");
