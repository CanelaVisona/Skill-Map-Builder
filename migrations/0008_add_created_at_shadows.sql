-- Add created_at column to journal_shadows table
ALTER TABLE "journal_shadows" ADD COLUMN "created_at" timestamp NOT NULL DEFAULT NOW();

-- Create index for ordering by creation time
CREATE INDEX IF NOT EXISTS "journal_shadows_user_created_idx" ON "journal_shadows"("user_id", "created_at");
