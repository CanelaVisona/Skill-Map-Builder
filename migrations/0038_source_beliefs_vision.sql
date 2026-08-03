-- Create source_beliefs table
CREATE TABLE IF NOT EXISTS "source_beliefs" (
  "id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar REFERENCES "users"("id") ON DELETE CASCADE,
  "area_id" varchar,
  "project_id" varchar,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT ''
);

-- Create source_vision table
CREATE TABLE IF NOT EXISTS "source_vision" (
  "id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar REFERENCES "users"("id") ON DELETE CASCADE,
  "area_id" varchar,
  "project_id" varchar,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT ''
);
