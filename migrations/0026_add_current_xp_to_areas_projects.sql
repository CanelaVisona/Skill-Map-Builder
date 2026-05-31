-- Add persistent XP counters to areas and projects
ALTER TABLE "areas"
  ADD COLUMN IF NOT EXISTS "current_xp" integer NOT NULL DEFAULT 0;

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "current_xp" integer NOT NULL DEFAULT 0;
