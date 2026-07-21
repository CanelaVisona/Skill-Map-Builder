-- Adds skillIds (jsonb array) alongside the legacy singular skillId column
-- for habits, rewiring_trackers and source_bug_records, so each can link to
-- more than one skill. Backfills from the existing skillId where present.

ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "rewiring_trackers" ADD COLUMN IF NOT EXISTS "skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "source_bug_records" ADD COLUMN IF NOT EXISTS "skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;

UPDATE "habits" SET "skill_ids" = jsonb_build_array("skill_id") WHERE "skill_id" IS NOT NULL AND "skill_ids" = '[]'::jsonb;
UPDATE "rewiring_trackers" SET "skill_ids" = jsonb_build_array("skill_id") WHERE "skill_id" IS NOT NULL AND "skill_ids" = '[]'::jsonb;
UPDATE "source_bug_records" SET "skill_ids" = jsonb_build_array("skill_id") WHERE "skill_id" IS NOT NULL AND "skill_ids" = '[]'::jsonb;
