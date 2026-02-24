-- Create global_skills table for tracking XP progress on skills/subskills
CREATE TABLE IF NOT EXISTS "global_skills" (
  "id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "area_id" varchar REFERENCES "areas"("id") ON DELETE CASCADE,
  "project_id" varchar REFERENCES "projects"("id") ON DELETE CASCADE,
  "parent_skill_id" varchar,
  "current_xp" integer NOT NULL DEFAULT 0,
  "level" integer NOT NULL DEFAULT 1,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

-- Add self-referential foreign key for parent_skill_id
ALTER TABLE "global_skills" ADD CONSTRAINT "global_skills_parent_fk" 
  FOREIGN KEY ("parent_skill_id") REFERENCES "global_skills"("id") ON DELETE CASCADE;

-- Add constraint: only one of area_id or project_id can be set
ALTER TABLE "global_skills" ADD CONSTRAINT "global_skills_area_or_project_check" 
  CHECK (
    ("area_id" IS NOT NULL AND "project_id" IS NULL) OR 
    ("area_id" IS NULL AND "project_id" IS NOT NULL) OR
    ("area_id" IS NULL AND "project_id" IS NULL AND "parent_skill_id" IS NOT NULL)
  );

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS "global_skills_user_idx" ON "global_skills"("user_id");
CREATE INDEX IF NOT EXISTS "global_skills_area_idx" ON "global_skills"("area_id");
CREATE INDEX IF NOT EXISTS "global_skills_project_idx" ON "global_skills"("project_id");
CREATE INDEX IF NOT EXISTS "global_skills_parent_idx" ON "global_skills"("parent_skill_id");
