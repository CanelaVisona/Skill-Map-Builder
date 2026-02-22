CREATE TABLE "journal_thoughts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"title" text NOT NULL,
	"sentence" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_thoughts" ADD CONSTRAINT "journal_thoughts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;