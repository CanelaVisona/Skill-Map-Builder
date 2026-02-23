-- Add level_subtitle_descriptions column to areas and projects tables
ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "level_subtitle_descriptions" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "level_subtitle_descriptions" jsonb NOT NULL DEFAULT '{}'::jsonb;
