-- Create source_objectives table
CREATE TABLE IF NOT EXISTS "source_objectives" (
  "id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar REFERENCES "users"("id") ON DELETE CASCADE,
  "area_id" varchar,
  "project_id" varchar,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT ''
);
