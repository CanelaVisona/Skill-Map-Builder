-- Add areaId and projectId to profile_experiences
ALTER TABLE "profile_experiences" ADD COLUMN IF NOT EXISTS "area_id" varchar;
ALTER TABLE "profile_experiences" ADD COLUMN IF NOT EXISTS "project_id" varchar;

-- Add areaId and projectId to profile_contributions
ALTER TABLE "profile_contributions" ADD COLUMN IF NOT EXISTS "area_id" varchar;
ALTER TABLE "profile_contributions" ADD COLUMN IF NOT EXISTS "project_id" varchar;

-- Create source_descriptions table
CREATE TABLE IF NOT EXISTS "source_descriptions" (
  "id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar REFERENCES "users"("id") ON DELETE CASCADE,
  "area_id" varchar,
  "project_id" varchar,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT ''
);

-- Create source_growth table
CREATE TABLE IF NOT EXISTS "source_growth" (
  "id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar REFERENCES "users"("id") ON DELETE CASCADE,
  "area_id" varchar,
  "project_id" varchar,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT ''
);
