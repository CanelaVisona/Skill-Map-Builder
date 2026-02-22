CREATE TABLE "profile_experiences" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE TABLE "profile_contributions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);
