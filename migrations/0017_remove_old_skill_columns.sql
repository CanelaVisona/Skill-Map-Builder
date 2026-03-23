-- Remove old skill-related columns that are no longer used
-- These columns were superseded by the skillId column and skill_linking feature
ALTER TABLE "habits" DROP COLUMN IF EXISTS "skill_progress_id";
ALTER TABLE "habits" DROP COLUMN IF EXISTS "skill_tree_skill_id";
