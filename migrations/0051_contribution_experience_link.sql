ALTER TABLE "profile_contributions" ADD COLUMN IF NOT EXISTS "experience_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
