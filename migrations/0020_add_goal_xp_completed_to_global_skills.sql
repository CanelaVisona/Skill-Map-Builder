-- Add goal_xp, completed, and completed_at fields to global_skills table
ALTER TABLE "global_skills" ADD COLUMN "goal_xp" integer NOT NULL DEFAULT 0;
ALTER TABLE "global_skills" ADD COLUMN "completed" boolean NOT NULL DEFAULT false;
ALTER TABLE "global_skills" ADD COLUMN "completed_at" timestamp;

-- Create index for completed skills queries
CREATE INDEX IF NOT EXISTS "global_skills_completed_idx" ON "global_skills"("completed");
CREATE INDEX IF NOT EXISTS "global_skills_goal_xp_idx" ON "global_skills"("goal_xp");
