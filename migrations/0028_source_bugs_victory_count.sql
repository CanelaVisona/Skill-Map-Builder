ALTER TABLE "source_bugs"
ADD COLUMN IF NOT EXISTS "victory_count" integer NOT NULL DEFAULT 0;
