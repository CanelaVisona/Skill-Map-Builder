-- Create habits table
CREATE TABLE IF NOT EXISTS "habits" (
  "id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL,
  "emoji" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '',
  "best_streak" integer DEFAULT 0,
  "created_at" timestamp DEFAULT NOW(),
  "updated_at" timestamp DEFAULT NOW(),
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Create habit_records table
CREATE TABLE IF NOT EXISTS "habit_records" (
  "id" varchar PRIMARY KEY NOT NULL,
  "habit_id" varchar NOT NULL,
  "user_id" varchar NOT NULL,
  "date" varchar NOT NULL,
  "completed" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT NOW(),
  FOREIGN KEY ("habit_id") REFERENCES "habits" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "habits_user_id_idx" ON "habits"("user_id");
CREATE INDEX IF NOT EXISTS "habit_records_habit_id_idx" ON "habit_records"("habit_id");
CREATE INDEX IF NOT EXISTS "habit_records_user_id_idx" ON "habit_records"("user_id");
CREATE INDEX IF NOT EXISTS "habit_records_habit_date_idx" ON "habit_records"("habit_id", "date");
CREATE INDEX IF NOT EXISTS "habit_records_date_range_idx" ON "habit_records"("habit_id", "date");
